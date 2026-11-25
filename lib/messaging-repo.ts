import "server-only";
import { greetingFirstName } from "@/lib/whatsapp";
import { logOutreachSend, savePreplannerEntry } from "@/lib/repo";
import { loadDatabase } from "@/lib/session";
import { isSupabaseMode, createClient } from "@/lib/supabase/server";
import { gmailAccountSecrets, touchGmailAccount } from "@/lib/supabase/write";
import { sendChannelMessage } from "@/lib/messaging-send";
import { canReceiveTexts, channelFamily, lineTypeOf, optedOut, withinWhatsAppWindow, type MessageChannelType, type MessageFamily } from "@/lib/messaging";
import { isTaggedContact } from "@/lib/contact-tags";
import { messagingSetupStatus, twilioFromNumber, twilioWhatsappNumber } from "@/lib/messaging-status";
import { fillTemplateBody, templateVarKeys, townFromCity, visitWhenFromScheduled } from "@/lib/whatsapp-vars";
import { findWhatsAppTemplate, twilioWhatsappContentSid, whatsappTemplateState } from "@/lib/whatsapp-template";
import { viewerPermissions } from "@/lib/model";
import { newId } from "@/lib/ids";
import { todayIso } from "@/lib/format";
import { appendNote, parseNotesLog, parseReachedHows } from "@/lib/preplanner";
import type { ActionResult, MessageItem, MessagingChannel, MessagingChannelType, User } from "@/lib/types";

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

function perms(actor: User) {
  return viewerPermissions(actor, todayIso());
}

export async function saveMessagingChannel(
  actor: User,
  input: {
    id?: string;
    type: MessagingChannelType;
    label: string;
    address: string;
    ownerUserId?: string | null;
    defaultStates?: string[];
    gmailAccountId?: string | null;
    domainSenderId?: string | null;
    status?: "active" | "disconnected";
  },
): Promise<ActionResult<{ id: string }>> {
  try {
    assert(perms(actor).canManage, "Only an admin can connect or change a messaging channel.");
    const setup = messagingSetupStatus();
    if (input.type === "email_gmail") assert(setup.gmail, "Setup needed: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    if (input.type === "email_resend") assert(setup.resend, "Setup needed: add RESEND_API_KEY.");
    if (input.type === "sms_twilio") assert(setup.sms, "Setup needed: add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.");
    if (input.type === "whatsapp_twilio") assert(setup.whatsapp, "Setup needed: add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER.");
    const address = input.address.trim() || (input.type === "sms_twilio" ? twilioFromNumber() ?? "" : input.type === "whatsapp_twilio" ? twilioWhatsappNumber() ?? "" : "");
    assert(address, "Enter the sending address or number.");
    const channel: MessagingChannel = {
      id: input.id ?? newId(),
      orgId: actor.orgId,
      type: input.type,
      ownerUserId: input.ownerUserId ?? null,
      label: input.label.trim() || address,
      address,
      defaultStates: (input.defaultStates ?? []).map((item) => item.trim().toUpperCase()).filter(Boolean),
      gmailAccountId: input.gmailAccountId ?? null,
      domainSenderId: input.domainSenderId ?? null,
      status: input.status ?? "active",
    };
    if (isSupabaseMode()) {
      const supabase = await createClient();
      const { error } = await supabase.from("outreach_channels").upsert({
        id: channel.id,
        org_id: channel.orgId,
        type: channel.type,
        owner_user_id: channel.ownerUserId,
        label: channel.label,
        address: channel.address,
        default_states: channel.defaultStates,
        gmail_account_id: channel.gmailAccountId,
        domain_sender_id: channel.domainSenderId,
        status: channel.status,
        created_by: actor.id,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true, data: { id: channel.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save that channel." };
  }
}

export async function disconnectMessagingChannel(actor: User, id: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can disconnect a messaging channel.");
    if (isSupabaseMode()) {
      const supabase = await createClient();
      const { error } = await supabase.from("outreach_channels").update({ status: "disconnected", updated_at: new Date().toISOString() }).eq("id", id).eq("org_id", actor.orgId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not disconnect that channel." };
  }
}

function easternNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Find this contact's Pre-planner entry, or add one, so "already reached out" stays accurate after a mass message. */
async function ensurePreplannerEntryId(actor: User, input: { entryId?: string; householdId: string; projectId?: string | null; family: MessageFamily }): Promise<string | null> {
  if (input.entryId) return input.entryId;
  const supabase = await createClient();
  const found = await supabase
    .from("preplanner_entries")
    .select("id")
    .eq("org_id", actor.orgId)
    .eq("household_id", input.householdId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (found.data?.id) return String(found.data.id);
  const how = input.family === "email" ? "email" : input.family === "whatsapp" ? "whatsapp" : "text";
  const now = easternNow();
  const saved = await savePreplannerEntry(actor, {
    householdId: input.householdId,
    reachedDate: now.date,
    reachedTime: now.time,
    reachedHow: [how],
    projectId: input.projectId ?? null,
    stage: "reached_out",
  });
  return saved.ok ? saved.data?.id ?? null : null;
}

export async function sendCampaignBatch(
  actor: User,
  inputs: Parameters<typeof sendCampaignMessage>[1][],
): Promise<{ ok: boolean; error?: string; person?: string }[]> {
  const out: { ok: boolean; error?: string }[] = [];
  for (const input of inputs.slice(0, 10)) {
    const result = await sendCampaignMessage(actor, input);
    out.push(result.ok ? { ok: true } : { ok: false, error: result.error });
  }
  return out;
}

export async function sendCampaignMessage(
  actor: User,
  input: {
    channelId?: string;
    type: MessageChannelType;
    to: string;
    body: string;
    subject?: string;
    householdId: string;
    personId?: string;
    projectId?: string | null;
    templateName?: string;
    templateVars?: Record<string, string>;
    templateId?: string;
    preplannerEntryId?: string;
    /** Twilio Content SID to send as a WhatsApp template. */
    contentSid?: string;
    /** When true, send a free-form WhatsApp body (only allowed inside the 24-hour reply window). */
    freeform?: boolean;
  },
): Promise<ActionResult> {
  const family = channelFamily(input.type);
  const mode = family === "email" ? "email" : family === "whatsapp" ? "whatsapp" : "sms";
  const log = async (status: string, error?: string) => {
    await logOutreachSend(actor, {
      mode,
      templateId: input.templateId,
      templateName: input.templateName,
      subject: input.subject ?? "",
      body: input.body,
      recipientCount: 1,
      fromAddress: undefined,
      method: input.type,
      toAddress: input.to,
      status,
      error,
      householdId: input.householdId,
      personId: input.personId,
    });
  };
  try {
    assert(perms(actor).canMessage, "You don't have permission to send from the CRM.");
    const db = await loadDatabase();
    const person = input.personId ? db.people.find((item) => item.id === input.personId) : undefined;
    if (person && optedOut(person, family)) {
      await log("skipped", "Opted out");
      return { ok: false, error: "This person has opted out of that channel." };
    }
    const house = db.households.find((item) => item.id === input.householdId);
    if (house && isTaggedContact(house.tags ?? [])) {
      await log("skipped", "Removed contact");
      return { ok: false, error: "This contact was removed (Not Jewish, Deceased or Probably doesn't exist)." };
    }
    if (family === "sms" && person && !canReceiveTexts(lineTypeOf(person, input.to))) {
      await log("skipped", "Landline or home phone");
      return { ok: false, error: "That number is a landline or home phone line and can't get texts." };
    }
    if (!isSupabaseMode()) {
      await log("failed", "Messaging needs the live CRM.");
      return { ok: false, error: "Messaging needs the live CRM." };
    }
    const channel = input.channelId ? (db.messagingChannels ?? []).find((item) => item.id === input.channelId) : (db.messagingChannels ?? []).find((item) => item.type === input.type && item.status === "active");
    const fromAddress = channel?.address || (family === "whatsapp" ? twilioWhatsappNumber() : family === "sms" ? twilioFromNumber() : "") || "";
    const fromName = (db.domainSenders ?? []).find((item) => item.email.toLowerCase() === fromAddress.toLowerCase())?.fromName;
    let gmailCipher: string | undefined;
    let gmailIv: string | undefined;
    const gmailAccountId = channel?.gmailAccountId || (input.type === "email_gmail" ? db.gmailAccounts?.[0]?.id : undefined);
    if (input.type === "email_gmail") {
      assert(gmailAccountId, "Connect Gmail first.");
      const secrets = await gmailAccountSecrets(gmailAccountId);
      assert(secrets, "That Gmail account is no longer connected.");
      gmailCipher = secrets.cipher;
      gmailIv = secrets.iv;
    }
    let templateName = input.templateName;
    let templateVars = input.templateVars;
    let body = input.body;
    if (family === "whatsapp") {
      const thread = (db.messageThreads ?? []).find((item) => {
        if (item.householdId !== input.householdId) return false;
        if (channelFamily(item.channelType) !== "whatsapp") return false;
        const wanted = input.to.replace(/^whatsapp:/i, "").replace(/\D/g, "");
        const have = item.contactAddress.replace(/^whatsapp:/i, "").replace(/\D/g, "");
        return !wanted || have.slice(-10) === wanted.slice(-10);
      });
      const inWindow = withinWhatsAppWindow(thread?.lastInboundAt);
      const tpl = await whatsappTemplateState();
      const selected = findWhatsAppTemplate(tpl, input.contentSid || twilioWhatsappContentSid());
      const first = greetingFirstName(person?.name || (db.households.find((item) => item.id === input.householdId)?.name ?? ""));
      if (selected?.status === "approved" && !input.freeform) {
        const keys = selected.variables?.length ? selected.variables : templateVarKeys(selected.body || "");
        const house = db.households.find((item) => item.id === input.householdId);
        const entry = (db.preplannerEntries ?? []).find((item) => item.id === input.preplannerEntryId)
          ?? (db.preplannerEntries ?? []).find((item) => item.householdId === input.householdId && item.scheduledAt);
        const supplied = input.templateVars ?? {};
        const vars: Record<string, string> = { "1": first };
        for (const key of keys) {
          if (key === "1") continue;
          let value = (supplied[key] ?? "").trim();
          if (!value && key === "2") value = townFromCity(house?.city);
          if (!value && key === "3") value = visitWhenFromScheduled(entry?.scheduledAt, house?.state);
          if (!value) {
            throw new Error(key === "2"
              ? "No town on file for this contact, so the WhatsApp visit message can't be filled in."
              : key === "3"
                ? "Add a visit date/time for this WhatsApp template."
                : `Missing a value for WhatsApp template variable {{${key}}}.`);
          }
          vars[key] = value;
        }
        templateName = selected.sid;
        templateVars = vars;
        body = fillTemplateBody(selected.body || body || `Hi ${first}`, vars);
      } else if (inWindow && body.trim()) {
        templateName = undefined;
        templateVars = undefined;
      } else if (selected && selected.status !== "approved") {
        throw new Error(`The WhatsApp template (${selected.label || selected.name}) is still waiting for Meta approval. You can send a free-form message only within 24 hours of a contact's reply.`);
      } else if (tpl.status !== "approved") {
        throw new Error("The WhatsApp template is still waiting for Meta approval. You can send a free-form message only within 24 hours of a contact's reply.");
      } else {
        throw new Error("Pick an approved WhatsApp template, or write a message within 24 hours of a contact's reply.");
      }
    }
    const providerId = await sendChannelMessage({
      type: input.type,
      to: input.to,
      body,
      subject: input.subject,
      fromAddress: input.type === "email_gmail" && gmailCipher ? (channel?.address || fromAddress) : fromAddress,
      fromName,
      gmailCipher,
      gmailIv,
      personId: input.personId,
      templateName,
      templateVars,
    });
    if (gmailAccountId) {
      try { await touchGmailAccount(gmailAccountId); } catch { /* still sent */ }
    }
    const supabase = await createClient();
    const address = input.to.trim().toLowerCase();
    const typ = input.type;
    let threadId: string | null = (db.messageThreads ?? []).find(
      (thread) => thread.householdId === input.householdId && thread.channelType === typ && thread.contactAddress.toLowerCase() === address,
    )?.id ?? null;
    if (!threadId) {
      const inserted = await supabase.from("message_threads").insert({
        org_id: actor.orgId,
        household_id: input.householdId,
        person_id: input.personId ?? null,
        channel_id: channel?.id ?? null,
        channel_type: typ,
        contact_address: address,
        project_id: input.projectId ?? null,
        last_at: new Date().toISOString(),
        last_preview: body.slice(0, 180),
        last_direction: "out",
        unread_count: 0,
      }).select("id").single();
      if (inserted.error) throw new Error(inserted.error.message);
      threadId = inserted.data?.id ?? newId();
    } else {
      await supabase.from("message_threads").update({
        last_at: new Date().toISOString(),
        last_preview: body.slice(0, 180),
        last_direction: "out",
        channel_id: channel?.id ?? null,
        project_id: input.projectId ?? null,
      }).eq("id", threadId);
    }
    const { error } = await supabase.from("message_messages").insert({
      thread_id: threadId,
      org_id: actor.orgId,
      household_id: input.householdId,
      person_id: input.personId ?? null,
      channel_id: channel?.id ?? null,
      channel_type: typ,
      direction: "out",
      body,
      subject: input.subject ?? null,
      status: "sent",
      provider: family === "email" ? (input.type === "email_gmail" ? "gmail" : "resend") : "twilio",
      provider_message_id: providerId,
      template_name: input.templateName ?? null,
      template_vars: templateVars ?? null,
      sent_by: actor.id,
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    try {
      const entryId = await ensurePreplannerEntryId(actor, { entryId: input.preplannerEntryId, householdId: input.householdId, projectId: input.projectId, family });
      if (entryId) {
        await logPreplannerSend({
          entryId,
          householdId: input.householdId,
          orgId: actor.orgId,
          actorName: actor.name,
          family,
          channelLabel: channel?.label || fromAddress || input.type,
        });
      }
    } catch { /* the message was sent; tracking is best effort */ }
    await log("sent");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send that message.";
    try { await log("failed", message); } catch { /* ignore */ }
    return { ok: false, error: message };
  }
}


async function logPreplannerSend(input: {
  entryId: string;
  householdId: string;
  orgId: string;
  actorName: string;
  family: MessageFamily;
  channelLabel: string;
}) {
  const how = input.family === "email" ? "email" : input.family === "whatsapp" ? "whatsapp" : "text";
  const supabase = await createClient();
  const loaded = await supabase
    .from("preplanner_entries")
    .select("id, household_id, notes, notes_log, reached_how, reached_hows")
    .eq("id", input.entryId)
    .eq("org_id", input.orgId)
    .eq("household_id", input.householdId)
    .maybeSingle();
  if (loaded.error) throw new Error(loaded.error.message);
  if (!loaded.data) return;
  const hows = parseReachedHows(loaded.data.reached_hows ?? loaded.data.reached_how);
  const nextHows = hows.includes(how as typeof hows[number]) ? hows : [...hows, how as typeof hows[number]];
  const note = `Sent ${how === "email" ? "email" : how === "whatsapp" ? "WhatsApp" : "a text"} via ${input.channelLabel}.`;
  const notesLog = appendNote(parseNotesLog(loaded.data.notes_log, String(loaded.data.notes ?? "")), note, input.actorName);
  const { error } = await supabase
    .from("preplanner_entries")
    .update({
      notes_log: notesLog,
      reached_how: nextHows[0] ?? how,
      reached_hows: nextHows,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.entryId)
    .eq("org_id", input.orgId);
  if (error) throw new Error(error.message);
}


/** Log a WhatsApp (or other) send that went out from the user's phone via wa.me, without calling Twilio. */
export async function recordExternalMessage(
  actor: User,
  input: {
    type: MessageChannelType;
    to: string;
    body: string;
    householdId: string;
    personId?: string;
    projectId?: string | null;
    templateName?: string;
    templateId?: string;
    preplannerEntryId?: string;
    provider?: string;
    channelLabel?: string;
  },
): Promise<ActionResult> {
  const family = channelFamily(input.type);
  const mode = family === "email" ? "email" : family === "whatsapp" ? "whatsapp" : "sms";
  try {
    assert(perms(actor).canMessage, "You don't have permission to send from the CRM.");
    if (!isSupabaseMode()) return { ok: false, error: "Messaging needs the live CRM." };
    const db = await loadDatabase();
    const person = input.personId ? db.people.find((item) => item.id === input.personId) : undefined;
    if (person && optedOut(person, family)) {
      await logOutreachSend(actor, {
        mode, templateId: input.templateId, templateName: input.templateName, subject: "", body: input.body,
        recipientCount: 1, method: input.type, toAddress: input.to, status: "skipped", error: "Opted out",
        householdId: input.householdId, personId: input.personId,
      });
      return { ok: false, error: "This person has opted out of that channel." };
    }
    const channel = (db.messagingChannels ?? []).find((item) => item.type === input.type && item.status === "active");
    const supabase = await createClient();
    const address = input.to.trim().toLowerCase();
    const typ = input.type;
    let threadId: string | null = (db.messageThreads ?? []).find(
      (thread) => thread.householdId === input.householdId && thread.channelType === typ && thread.contactAddress.toLowerCase() === address,
    )?.id ?? null;
    if (!threadId) {
      const inserted = await supabase.from("message_threads").insert({
        org_id: actor.orgId,
        household_id: input.householdId,
        person_id: input.personId ?? null,
        channel_id: channel?.id ?? null,
        channel_type: typ,
        contact_address: address,
        project_id: input.projectId ?? null,
        last_at: new Date().toISOString(),
        last_preview: input.body.slice(0, 180),
        last_direction: "out",
        unread_count: 0,
      }).select("id").single();
      if (inserted.error) throw new Error(inserted.error.message);
      threadId = inserted.data?.id ?? newId();
    } else {
      await supabase.from("message_threads").update({
        last_at: new Date().toISOString(),
        last_preview: input.body.slice(0, 180),
        last_direction: "out",
        channel_id: channel?.id ?? null,
        project_id: input.projectId ?? null,
      }).eq("id", threadId);
    }
    const { error } = await supabase.from("message_messages").insert({
      thread_id: threadId,
      org_id: actor.orgId,
      household_id: input.householdId,
      person_id: input.personId ?? null,
      channel_id: channel?.id ?? null,
      channel_type: typ,
      direction: "out",
      body: input.body,
      subject: null,
      status: "sent",
      provider: input.provider || "wa.me",
      provider_message_id: newId(),
      template_name: input.templateName ?? null,
      sent_by: actor.id,
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    try {
      const entryId = await ensurePreplannerEntryId(actor, { entryId: input.preplannerEntryId, householdId: input.householdId, projectId: input.projectId, family });
      if (entryId) {
        await logPreplannerSend({
          entryId,
          householdId: input.householdId,
          orgId: actor.orgId,
          actorName: actor.name,
          family,
          channelLabel: input.channelLabel || channel?.label || "WhatsApp on your phone",
        });
      }
    } catch { /* logged below */ }
    await logOutreachSend(actor, {
      mode, templateId: input.templateId, templateName: input.templateName, subject: "", body: input.body,
      recipientCount: 1, method: input.type, toAddress: input.to, status: "sent",
      householdId: input.householdId, personId: input.personId,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not log that message.";
    try {
      await logOutreachSend(actor, {
        mode, templateId: input.templateId, templateName: input.templateName, subject: "", body: input.body,
        recipientCount: 1, method: input.type, toAddress: input.to, status: "failed", error: message,
        householdId: input.householdId, personId: input.personId,
      });
    } catch { /* ignore */ }
    return { ok: false, error: message };
  }
}

export async function loadThreadMessages(actor: User, threadId: string): Promise<ActionResult<MessageItem[]>> {
  try {
    if (!isSupabaseMode()) return { ok: true, data: [] };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("message_messages")
      .select("id, thread_id, household_id, person_id, channel_type, direction, body, subject, status, error, created_at, sent_by, template_name")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((row) => ({
      id: String(row.id),
      threadId: String(row.thread_id),
      householdId: String(row.household_id),
      personId: row.person_id ? String(row.person_id) : null,
      channelType: String(row.channel_type),
      direction: row.direction === "in" ? "in" as const : "out" as const,
      body: String(row.body ?? ""),
      subject: row.subject ? String(row.subject) : null,
      status: String(row.status ?? ""),
      error: row.error ? String(row.error) : null,
      createdAt: String(row.created_at),
      sentBy: row.sent_by ? String(row.sent_by) : null,
      templateName: row.template_name ? String(row.template_name) : null,
    }));
    return { ok: true, data: rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not load the thread." };
  }
}

export async function markThreadRead(actor: User, threadId: string): Promise<ActionResult> {
  try {
    if (!isSupabaseMode()) return { ok: true };
    const supabase = await createClient();
    const { error } = await supabase.from("message_threads").update({ unread_count: 0 }).eq("id", threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not mark the thread read." };
  }
}
