import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { sendViaGmail, sendViaResend, withUnsubscribeFooter, unsubscribeUrlFor } from "@/lib/mail-send";
import { decryptSecret } from "@/lib/mail-crypto";
import { createClient, createEphemeralClient } from "@/lib/supabase/server";
import {
  channelFamily,
  phoneDigits,
  smsOptOutCommand,
  toE164,
  type MessageChannelType,
  type MessageFamily,
} from "@/lib/messaging";
import { messagingIngestKey, twilioFromNumber, twilioWhatsappNumber } from "@/lib/messaging-status";

function twilioSid() {
  return process.env.TWILIO_ACCOUNT_SID?.trim() || "";
}
function twilioToken() {
  return process.env.TWILIO_AUTH_TOKEN?.trim() || "";
}

export function verifyTwilioSignature(input: {
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  const token = twilioToken();
  const signature = input.signature ?? "";
  if (!token || !signature) return false;
  const sorted = Object.keys(input.params)
    .sort()
    .map((key) => key + input.params[key])
    .join("");
  const expected = createHmac("sha1", token).update(input.url + sorted, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function sendTwilioMessage(input: {
  to: string;
  from: string;
  body?: string;
  whatsapp?: boolean;
  templateName?: string;
  templateVars?: Record<string, string>;
}): Promise<string> {
  const sid = twilioSid();
  const token = twilioToken();
  if (!sid || !token) throw new Error("Twilio is not set up yet.");
  const to = input.whatsapp
    ? (input.to.startsWith("whatsapp:") ? input.to : `whatsapp:${toE164(input.to) ?? input.to}`)
    : (toE164(input.to) ?? input.to);
  const from = input.whatsapp
    ? (input.from.startsWith("whatsapp:") ? input.from : `whatsapp:${input.from}`)
    : input.from;
  const body = new URLSearchParams({ To: to, From: from });
  if (input.templateName) {
    body.set("ContentSid", input.templateName);
    if (input.templateVars && Object.keys(input.templateVars).length) {
      body.set("ContentVariables", JSON.stringify(input.templateVars));
    }
  } else {
    body.set("Body", input.body ?? "");
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as { sid?: string; message?: string; error_message?: string };
  if (!res.ok || !json.sid) throw new Error(json.error_message || json.message || "Twilio could not send that message.");
  return json.sid;
}

export async function sendChannelMessage(input: {
  type: MessageChannelType;
  to: string;
  body: string;
  subject?: string;
  fromAddress: string;
  fromName?: string;
  gmailCipher?: string;
  gmailIv?: string;
  personId?: string;
  templateName?: string;
  templateVars?: Record<string, string>;
}): Promise<string> {
  const family = channelFamily(input.type);
  if (family === "email") {
    let body = input.body;
    if (input.type === "email_resend" && input.personId) {
      const url = await unsubscribeUrlFor(input.personId, input.to);
      body = withUnsubscribeFooter(body, url);
    }
    if (input.type === "email_gmail") {
      if (!input.gmailCipher || !input.gmailIv) throw new Error("Connect Gmail first.");
      return sendViaGmail({
        cipher: input.gmailCipher,
        iv: input.gmailIv,
        from: input.fromAddress,
        to: input.to,
        subject: input.subject || "A message from Chabad",
        body,
      });
    }
    return sendViaResend({
      fromName: input.fromName ?? "",
      fromEmail: input.fromAddress,
      to: input.to,
      subject: input.subject || "A message from Chabad",
      body,
    });
  }
  if (family === "whatsapp") {
    return sendTwilioMessage({
      to: input.to,
      from: input.fromAddress || twilioWhatsappNumber() || "",
      body: input.body,
      whatsapp: true,
      templateName: input.templateName,
      templateVars: input.templateVars,
    });
  }
  return sendTwilioMessage({
    to: input.to,
    from: input.fromAddress || twilioFromNumber() || "",
    body: input.body,
  });
}

export type MatchedContact = {
  orgId: string;
  householdId: string;
  personId: string | null;
  name: string;
};

export async function matchContactByAddress(opts: {
  orgId?: string | null;
  family: MessageFamily;
  address: string;
}): Promise<MatchedContact | null> {
  const key = messagingIngestKey();
  if (!key) return null;
  const supabase = createEphemeralClient();
  const { data, error } = await supabase.rpc("match_contact_address", {
    p_key: key,
    p_org: opts.orgId ?? null,
    p_family: opts.family,
    p_address: opts.address,
  });
  if (error || !data?.length) return null;
  const row = data[0] as { org_id: string; household_id: string; person_id: string; name: string };
  return { orgId: row.org_id, householdId: row.household_id, personId: row.person_id, name: row.name ?? "" };
}

export async function ingestInbound(payload: {
  orgId?: string;
  householdId?: string;
  personId?: string | null;
  channelId?: string | null;
  channelType: string;
  contactAddress: string;
  body: string;
  subject?: string;
  provider: string;
  providerMessageId: string;
  projectId?: string | null;
}): Promise<{ id: string; duplicate?: boolean } | { error: string }> {
  const key = messagingIngestKey();
  if (!key) return { error: "Inbound messaging is not set up yet (MESSAGING_INGEST_KEY)." };
  const supabase = createEphemeralClient();
  const { data, error } = await supabase.rpc("ingest_inbound_message", {
    p_key: key,
    payload: {
      org_id: payload.orgId ?? null,
      household_id: payload.householdId ?? null,
      person_id: payload.personId ?? null,
      channel_id: payload.channelId ?? null,
      channel_type: payload.channelType,
      contact_address: payload.contactAddress,
      body: payload.body,
      subject: payload.subject ?? null,
      provider: payload.provider,
      provider_message_id: payload.providerMessageId,
      project_id: payload.projectId ?? null,
    },
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { id: "duplicate", duplicate: true };
    return { error: error.message };
  }
  return { id: String(data) };
}

export async function applyOptOut(personId: string, family: MessageFamily, optedOut: boolean) {
  const key = messagingIngestKey();
  if (!key) return;
  const supabase = createEphemeralClient();
  const channel = family === "email" ? "email" : family === "whatsapp" ? "whatsapp" : "sms";
  await supabase.rpc("set_person_channel_opt_out_ingest", {
    p_key: key,
    target_id: personId,
    channel,
    opted_out: optedOut,
  });
}

export { smsOptOutCommand, decryptSecret };
