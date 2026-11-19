import "server-only";
import { ingestInbound } from "@/lib/messaging-send";
import { saveHousehold } from "@/lib/repo";
import { channelFamily } from "@/lib/messaging";
import { createClient, isSupabaseMode } from "@/lib/supabase/server";
import type { ActionResult, HouseholdInput, User } from "@/lib/types";

export type UnmatchedItem = {
  id: string;
  channelType: string;
  address: string;
  senderName: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: string;
};

type Row = {
  id: string; org_id: string; channel_type: string; address: string; sender_name: string | null; subject: string | null;
  body: string; provider: string; provider_message_id: string; channel_id: string | null; status: string; received_at?: string;
};

function adminOnly(user: User): string | null {
  if (user.role !== "admin") return "Only admins can handle unknown senders.";
  return null;
}

export async function listUnmatched(user: User): Promise<ActionResult<UnmatchedItem[]>> {
  const denied = adminOnly(user);
  if (denied || !isSupabaseMode()) return { ok: true, data: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_unmatched_messages");
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: ((data ?? []) as (Row & { received_at: string })[]).map((row) => ({
      id: row.id,
      channelType: row.channel_type,
      address: row.address,
      senderName: row.sender_name ?? "",
      subject: row.subject ?? "",
      body: row.body,
      receivedAt: row.received_at,
      status: row.status,
    })),
  };
}

async function load(id: string): Promise<Row> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_unmatched_message", { p_id: id });
  if (error) throw new Error(error.message);
  const row = (data as Row[] | null)?.[0];
  if (!row) throw new Error("That message is no longer here.");
  if (row.status !== "open") throw new Error("That message was already handled.");
  return row;
}

/** Puts the saved number or email on the contact's first person when it is not already there. */
async function addAddressToContact(row: Row, householdId: string): Promise<{ personId: string | null; note?: string }> {
  const supabase = await createClient();
  const { data: people } = await supabase
    .from("people")
    .select("id, phone, phone2, phone3, extra_phones, email, whatsapp, sort_order")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true });
  const first = (people ?? [])[0] as Record<string, unknown> | undefined;
  if (!first) return { personId: null, note: "That contact has no person to add it to." };
  const personId = String(first.id);
  if (channelFamily(row.channel_type as never) === "email") {
    const email = String(first.email ?? "").trim();
    if (!email) {
      const { error } = await supabase.from("people").update({ email: row.address.toLowerCase() }).eq("id", personId);
      if (error) throw new Error(error.message);
      return { personId };
    }
    return { personId, note: email.toLowerCase() === row.address.toLowerCase() ? undefined : "The contact already has an email, so the new address was not added." };
  }
  const last10 = (value: string) => value.replace(/\D/g, "").slice(-10);
  const target = last10(row.address);
  const slots = ["phone", "phone2", "phone3"] as const;
  const extras = ((first.extra_phones as string[] | null) ?? []).filter(Boolean);
  const have = [...slots.map((key) => String(first[key] ?? "")), ...extras, String(first.whatsapp ?? "")].map(last10);
  if (have.includes(target)) return { personId };
  const empty = slots.find((key) => !String(first[key] ?? "").trim());
  const patch = empty ? { [empty]: row.address } : { extra_phones: [...extras, row.address] };
  const { error } = await supabase.from("people").update(patch).eq("id", personId);
  if (error) throw new Error(error.message);
  return { personId };
}

async function moveToContact(user: User, row: Row, householdId: string, personId: string | null): Promise<void> {
  const result = await ingestInbound({
    orgId: row.org_id,
    householdId,
    personId,
    channelId: row.channel_id,
    channelType: row.channel_type,
    contactAddress: row.address,
    body: row.body,
    subject: row.subject ?? undefined,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
  });
  if ("error" in result) throw new Error(result.error);
  const supabase = await createClient();
  const resolved = await supabase.rpc("resolve_unmatched_message", { p_id: row.id, p_status: "attached", p_household: householdId });
  if (resolved.error) throw new Error(resolved.error.message);
  void user;
}

export async function attachUnmatched(user: User, input: { id: string; householdId: string; addToContact: boolean }): Promise<ActionResult> {
  try {
    const denied = adminOnly(user);
    if (denied) return { ok: false, error: denied };
    const row = await load(input.id);
    let personId: string | null = null;
    let note: string | undefined;
    if (input.addToContact) {
      const added = await addAddressToContact(row, input.householdId);
      personId = added.personId;
      note = added.note;
    } else {
      const supabase = await createClient();
      const { data } = await supabase.from("people").select("id").eq("household_id", input.householdId).order("sort_order", { ascending: true }).limit(1);
      personId = (data?.[0]?.id as string | undefined) ?? null;
    }
    await moveToContact(user, row, input.householdId, personId);
    return note ? { ok: true, warning: note } : { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not attach that message." };
  }
}

export async function createFromUnmatched(
  user: User,
  input: { id: string; name: string; projectId: string; state: string; city: string },
): Promise<ActionResult> {
  try {
    const denied = adminOnly(user);
    if (denied) return { ok: false, error: denied };
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Enter a name." };
    const row = await load(input.id);
    const email = channelFamily(row.channel_type as never) === "email";
    const form: HouseholdInput = {
      name, street: "", city: input.city.trim(), state: input.state.trim(), zip: "", country: "USA", lat: "", lng: "",
      extraAddresses: [], notes: `Created from an unknown sender (${row.address}).`, projectId: input.projectId, scheduleCategoryId: "",
      categoryIds: [], tags: "", customFields: {}, sharedWithCora: true, ownerId: "", visitReaction: "", visits: [],
      people: [{ name, gender: "", phone: email ? "" : row.address, phone2: "", phone3: "", email: email ? row.address.toLowerCase() : "", whatsapp: "" }],
    };
    const saved = await saveHousehold(user, form);
    if (!saved.ok) return saved;
    const householdId = saved.data?.id;
    if (!householdId) return { ok: false, error: "The contact was created but its id was not returned." };
    const supabase = await createClient();
    const { data } = await supabase.from("people").select("id").eq("household_id", householdId).order("sort_order", { ascending: true }).limit(1);
    await moveToContact(user, row, householdId, (data?.[0]?.id as string | undefined) ?? null);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create that contact." };
  }
}

export async function dismissUnmatched(user: User, id: string): Promise<ActionResult> {
  try {
    const denied = adminOnly(user);
    if (denied) return { ok: false, error: denied };
    const supabase = await createClient();
    const { error } = await supabase.rpc("resolve_unmatched_message", { p_id: id, p_status: "dismissed", p_household: null });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not dismiss that message." };
  }
}
