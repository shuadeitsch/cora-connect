export const MESSAGE_CHANNEL_TYPES = [
  { id: "email_gmail", family: "email", label: "Gmail" },
  { id: "email_resend", family: "email", label: "Domain email" },
  { id: "sms_twilio", family: "sms", label: "Text" },
  { id: "whatsapp_twilio", family: "whatsapp", label: "WhatsApp" },
] as const;

export type MessageChannelType = (typeof MESSAGE_CHANNEL_TYPES)[number]["id"];
export type MessageFamily = "email" | "sms" | "whatsapp";

export function channelFamily(type: string): MessageFamily {
  if (type === "email_gmail" || type === "email_resend" || type === "email") return "email";
  if (type === "whatsapp_twilio" || type === "whatsapp") return "whatsapp";
  return "sms";
}

export function channelTypeLabel(type: string): string {
  return MESSAGE_CHANNEL_TYPES.find((item) => item.id === type)?.label
    ?? (channelFamily(type) === "email" ? "Email" : channelFamily(type) === "whatsapp" ? "WhatsApp" : "Text");
}

export function reachedHowForFamily(family: MessageFamily): "email" | "text" | "whatsapp" {
  return family === "email" ? "email" : family === "whatsapp" ? "whatsapp" : "text";
}

/** Last 10 digits, so US numbers match with or without +1. */
export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function phonesOf(person: { phone?: string; phone2?: string; phone3?: string; extraPhones?: string[]; whatsapp?: string }): string[] {
  return [person.phone, person.phone2, person.phone3, ...(person.extraPhones ?? []), person.whatsapp]
    .map((item) => phoneDigits(item ?? ""))
    .filter((item) => item.length >= 10);
}

export function toE164(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

export function emailsOf(person: { email?: string }): string[] {
  const email = (person.email ?? "").trim().toLowerCase();
  return email && email.includes("@") ? [email] : [];
}

export type ContactablePerson = {
  id: string;
  householdId: string;
  name: string;
  email?: string;
  phone?: string;
  phone2?: string;
  phone3?: string;
  extraPhones?: string[];
  whatsapp?: string;
  emailOptOut?: boolean;
  smsOptOut?: boolean;
  whatsappOptOut?: boolean;
  /** Carrier line type per number, keyed by last 10 digits (mobile, nonFixedVoip, fixedVoip, landline, ...). */
  phoneLineTypes?: Record<string, string>;
};

/** Line type saved for this number (from a carrier lookup), or "" when unknown. */
export function lineTypeOf(person: Pick<ContactablePerson, "phoneLineTypes">, number: string): string {
  return (person.phoneLineTypes ?? {})[phoneDigits(number)]?.trim() ?? "";
}

/** Landlines and fixed (cable/home) VoIP lines can't receive texts. */
export function canReceiveTexts(lineType: string): boolean {
  const folded = lineType.toLowerCase().replace(/[^a-z]/g, "");
  return folded !== "landline" && folded !== "fixedvoip";
}

const TEXT_RANK: Record<string, number> = { mobile: 0, nonfixedvoip: 1 };

/** The one number to text: a known mobile first, then mobile VoIP, then unknown; never a landline or fixed VoIP. */
export function bestTextNumber(person: ContactablePerson): string | null {
  const ranked = addressesForFamily(person, "sms")
    .map((address, index) => ({ address, index, type: lineTypeOf(person, address).toLowerCase().replace(/[^a-z]/g, "") }))
    .filter((item) => canReceiveTexts(item.type))
    .sort((a, b) => (TEXT_RANK[a.type] ?? 2) - (TEXT_RANK[b.type] ?? 2) || a.index - b.index);
  return ranked[0]?.address ?? null;
}

export function addressForFamily(person: ContactablePerson, family: MessageFamily): string | null {
  if (family === "email") return emailsOf(person)[0] ?? null;
  if (family === "whatsapp") {
    const fromWa = phoneDigits(person.whatsapp ?? "");
    if (fromWa.length >= 10) return toE164(person.whatsapp ?? "");
    return toE164(person.phone || person.phone2 || person.phone3 || "");
  }
  return toE164(person.phone || person.phone2 || person.phone3 || person.whatsapp || "");
}

/** Every number on a person for texts or WhatsApp (whatsapp, phone, phone2, phone3, and any extra numbers), deduped by last 10 digits. Email returns its one address. */
export function addressesForFamily(person: ContactablePerson, family: MessageFamily): string[] {
  if (family === "email") {
    const email = emailsOf(person)[0];
    return email ? [email] : [];
  }
  const order = family === "whatsapp"
    ? [person.whatsapp, person.phone, person.phone2, person.phone3, ...(person.extraPhones ?? [])]
    : [person.phone, person.phone2, person.phone3, ...(person.extraPhones ?? []), person.whatsapp];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of order) {
    const e164 = toE164(raw ?? "");
    const key = phoneDigits(raw ?? "");
    if (!e164 || key.length < 10 || seen.has(key)) continue;
    seen.add(key);
    out.push(e164);
  }
  return out;
}

export function optedOut(person: ContactablePerson, family: MessageFamily): boolean {
  if (family === "email") return Boolean(person.emailOptOut);
  if (family === "whatsapp") return Boolean(person.whatsappOptOut);
  return Boolean(person.smsOptOut);
}

const STOP_RE = /^(stop|stopall|unsubscribe|cancel|end|quit)\b/i;
const START_RE = /^(start|unstop|yes)\b/i;

export function smsOptOutCommand(body: string): "stop" | "start" | null {
  const trimmed = body.trim();
  if (STOP_RE.test(trimmed)) return "stop";
  if (START_RE.test(trimmed)) return "start";
  return null;
}

export type SkipReason =
  | "no-address"
  | "opted-out"
  | "already-contacted";

export type ContactedFact = {
  householdId: string;
  personId?: string | null;
  family: MessageFamily;
  projectId?: string | null;
  at?: string | null;
};

export function alreadyContacted(
  facts: ContactedFact[],
  householdId: string,
  family: MessageFamily,
  projectId?: string | null,
): boolean {
  const project = projectId && projectId !== "ALL" ? projectId : "";
  return facts.some((fact) => {
    if (fact.householdId !== householdId) return false;
    if (fact.family !== family) return false;
    if (project && fact.projectId && fact.projectId !== project) return false;
    return true;
  });
}

export type CampaignSkip = { householdId: string; name: string; reason: SkipReason; detail: string };

export function planCampaignAudience(input: {
  people: (ContactablePerson & { householdName: string })[];
  families: MessageFamily[];
  skipAlready: boolean;
  projectId?: string | null;
  facts: ContactedFact[];
  /** "Don't send to landlines" unticked: someone with no mobile-capable number gets one text to their first number. */
  allowLandlines?: boolean;
}): {
  ready: { person: ContactablePerson & { householdName: string }; family: MessageFamily; address: string }[];
  skipped: CampaignSkip[];
} {
  const ready: { person: ContactablePerson & { householdName: string }; family: MessageFamily; address: string }[] = [];
  const skipped: CampaignSkip[] = [];
  const seen = new Set<string>();
  for (const person of input.people) {
    for (const family of input.families) {
      const key = `${person.id}:${family}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const all = addressesForFamily(person, family);
      // One message per person per channel: texts go to the best mobile-capable number, WhatsApp to the first number, email to the first address.
      const best = family === "sms" ? (bestTextNumber(person) ?? (input.allowLandlines ? all[0] ?? null : null)) : all[0] ?? null;
      const addresses = best ? [best] : [];
      if (!addresses.length) {
        const detail = family === "sms" && all.length
          ? `Only landline / home phone numbers for ${person.name || "this person"}`
          : `No ${family === "email" ? "email" : "phone"} for ${person.name || "this person"}`;
        skipped.push({ householdId: person.householdId, name: person.householdName, reason: "no-address", detail });
        continue;
      }
      if (optedOut(person, family)) {
        skipped.push({ householdId: person.householdId, name: person.householdName, reason: "opted-out", detail: `${person.name || "This person"} opted out of ${family === "email" ? "email" : family === "whatsapp" ? "WhatsApp" : "texts"}` });
        continue;
      }
      if (input.skipAlready && alreadyContacted(input.facts, person.householdId, family, input.projectId)) {
        skipped.push({ householdId: person.householdId, name: person.householdName, reason: "already-contacted", detail: `Already contacted by ${family === "email" ? "email" : family === "whatsapp" ? "WhatsApp" : "text"} in this project` });
        continue;
      }
      for (const address of addresses) ready.push({ person, family, address });
    }
  }
  return { ready, skipped };
}

export function withinWhatsAppWindow(lastInboundAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastInboundAt) return false;
  const at = new Date(lastInboundAt).getTime();
  if (!Number.isFinite(at)) return false;
  return now - at < 24 * 60 * 60 * 1000;
}

export function defaultStatesOverlap(channelStates: string[] | null | undefined, state: string | null | undefined): boolean {
  const wanted = (state ?? "").trim().toUpperCase();
  const list = (channelStates ?? []).map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (!wanted || wanted === "ALL" || !list.length) return true;
  return list.includes(wanted);
}

function timeOf(value: string | null | undefined): number {
  const at = value ? Date.parse(value.replace(" ", "T").replace(/\+00$/, "Z")) : NaN;
  return Number.isFinite(at) ? at : 0;
}

/** Inbox order: threads with an unread reply first (newest reply on top), then everything else by most recent message. */
export function sortThreadsForInbox<T extends { lastAt: string; unreadCount: number; lastInboundAt?: string | null }>(threads: T[]): T[] {
  return threads.slice().sort((a, b) => {
    const unread = Number(b.unreadCount > 0) - Number(a.unreadCount > 0);
    if (unread) return unread;
    if (a.unreadCount > 0) return timeOf(b.lastInboundAt ?? b.lastAt) - timeOf(a.lastInboundAt ?? a.lastAt);
    return timeOf(b.lastAt) - timeOf(a.lastAt);
  });
}

/** Most recent message time (ms) per household, for sorting reply lists. */
export function latestMessageByHousehold(threads: { householdId: string; lastAt: string }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const thread of threads) {
    const at = timeOf(thread.lastAt);
    if (at > (out.get(thread.householdId) ?? 0)) out.set(thread.householdId, at);
  }
  return out;
}
