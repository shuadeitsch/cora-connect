import { stateLabel } from "@/lib/constants";
import { digitsOnly, firstName as firstWord } from "@/lib/format";
import type { HouseholdView, Person } from "@/lib/types";

export type OutreachMode = "email" | "text";

export type OutreachTemplate = {
  id: string;
  orgId?: string;
  name: string;
  subject: string;
  email: string;
  sms: string;
  sortOrder?: number;
};

/** Pre-made drafts. {first name} and {state} are filled per contact, or with a group-safe fallback. */
export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "visit-announcement",
    name: "Visit announcement",
    subject: "Yeshiva students visiting {state}",
    email: "Hi {first name}, Chabad of {state} is sending yeshiva students to visit {state}. Please let us know if you're interested!",
    sms: "Hi {first name}, Chabad of {state} is sending yeshiva students to visit {state}. Please let us know if you're interested!",
  },
  {
    id: "chanukah",
    name: "Chanukah / holiday visit",
    subject: "Chanukah visit from Chabad of {state}",
    email: "Hi {first name}, Chabad of {state} would love to visit you this Chanukah. May we stop by with a menorah, candles, and a little holiday cheer?",
    sms: "Hi {first name}, Chabad of {state} would love to visit for Chanukah. May we stop by with a menorah and candles?",
  },
  {
    id: "thank-you",
    name: "Follow-up thank you",
    subject: "Thank you from Chabad of {state}",
    email: "Hi {first name}, thank you for welcoming us. It was a pleasure to visit. If you'd like us to come again, or if we can help with anything, just reply to this message. Wishing you all the best from Chabad of {state}.",
    sms: "Hi {first name}, thank you for welcoming us. If you'd like another visit, or if we can help with anything, just reply. — Chabad of {state}",
  },
  {
    id: "in-the-area",
    name: "We're in the area",
    subject: "A visit from Chabad of {state}",
    email: "Hi {first name}, we'll have yeshiva students in {state} soon and would love to stop by for a short visit. If there's a day or time that works, please let us know. Looking forward to seeing you.",
    sms: "Hi {first name}, yeshiva students will be in {state} soon and would love to stop by. If a time works for you, please let us know!",
  },
];

export type OutreachPerson = {
  id: string;
  name: string;
  firstName: string;
  state: string;
  emails: string[];
  /** E.164-style, e.g. +12025550100. Empty if we could not normalize a number. */
  phones: string[];
  /** wa.me digits (country code, no plus), same numbers as phones. */
  waDigits: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function fillPlaceholders(template: string, vars: { firstName: string; state: string }): string {
  return template.replace(/\{first name\}/gi, vars.firstName).replace(/\{state\}/gi, vars.state);
}

/** Prefill a draft from a saved template, with {first name} and {state} already filled in. */
export function draftFromTemplate(
  template: OutreachTemplate,
  mode: OutreachMode,
  vars: { firstName: string; state: string },
): { subject: string; body: string } {
  return {
    subject: fillPlaceholders(template.subject, vars),
    body: fillPlaceholders(mode === "text" ? template.sms : template.email, vars),
  };
}

/** Use saved org templates when any exist; otherwise the built-in drafts. */
export function templatesOrDefault(list?: OutreachTemplate[] | null): OutreachTemplate[] {
  return list?.length ? list : OUTREACH_TEMPLATES;
}

/** Group email/SMS body: shared first name or "there"; shared state or "your area". */
export function groupFillVars(people: OutreachPerson[]): { firstName: string; state: string } {
  const names = [...new Set(people.map((row) => row.firstName.trim()).filter(Boolean))];
  const states = [...new Set(people.map((row) => row.state.trim()).filter(Boolean))];
  return {
    firstName: names.length === 1 ? names[0]! : "there",
    state: states.length === 1 ? states[0]! : "your area",
  };
}

export function contactFirstName(household: HouseholdView): string {
  const person = household.people[0]?.name.trim();
  const source = person || household.name;
  return firstWord(source);
}

export function contactStateLabel(household: HouseholdView): string {
  return stateLabel(household.state || "").trim() || household.state.trim();
}

function uniqueEmails(people: Person[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    const email = person.email.trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

/** US 10-digit numbers become +1…; 11-digit numbers that start with 1 stay +1…; other digit strings keep their leading country code. */
export function normalizeUsPhone(value: string): { e164: string; waDigits: string } | null {
  const raw = value.trim();
  if (!raw) return null;
  let digits = digitsOnly(raw);
  if (!digits) return null;
  if (digits.length === 10) digits = `1${digits}`;
  if (digits.length < 10) return null;
  return { e164: `+${digits}`, waDigits: digits };
}

function uniquePhones(people: Person[]): { e164: string; waDigits: string }[] {
  const out: { e164: string; waDigits: string }[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    for (const value of [person.phone, person.phone2, person.phone3, person.whatsapp]) {
      const parsed = normalizeUsPhone(value);
      if (!parsed || seen.has(parsed.e164)) continue;
      seen.add(parsed.e164);
      out.push(parsed);
    }
  }
  return out;
}

export function outreachPeople(households: HouseholdView[]): OutreachPerson[] {
  return households.map((household) => {
    const phones = uniquePhones(household.people);
    return {
      id: household.id,
      name: household.name,
      firstName: contactFirstName(household),
      state: contactStateLabel(household),
      emails: uniqueEmails(household.people),
      phones: phones.map((row) => row.e164),
      waDigits: phones.map((row) => row.waDigits),
    };
  });
}

export function emailsForCopy(people: OutreachPerson[]): { addresses: string[]; skipped: number } {
  const addresses: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const person of people) {
    if (!person.emails.length) {
      skipped += 1;
      continue;
    }
    for (const email of person.emails) {
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      addresses.push(email);
    }
  }
  return { addresses, skipped };
}

export function phonesForCopy(people: OutreachPerson[]): { numbers: string[]; skipped: number } {
  const numbers: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const person of people) {
    if (!person.phones.length) {
      skipped += 1;
      continue;
    }
    for (const phone of person.phones) {
      if (seen.has(phone)) continue;
      seen.add(phone);
      numbers.push(phone);
    }
  }
  return { numbers, skipped };
}

export const MAILTO_SAFE_LENGTH = 2000;

export function mailtoBccHref(input: { emails: string[]; subject: string; body: string }): string {
  const parts: string[] = [];
  if (input.emails.length) parts.push(`bcc=${encodeURIComponent(input.emails.join(","))}`);
  if (input.subject) parts.push(`subject=${encodeURIComponent(input.subject)}`);
  if (input.body) parts.push(`body=${encodeURIComponent(input.body)}`);
  return `mailto:?${parts.join("&")}`;
}

export function detectSmsPlatform(): "ios" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

export function smsHrefWithBody(phone: string, body: string, platform: "ios" | "other" = "other"): string {
  const parsed = normalizeUsPhone(phone);
  const dest = parsed?.e164 || phone;
  const enc = encodeURIComponent(body);
  return platform === "ios" ? `sms:${dest}&body=${enc}` : `sms:${dest}?body=${enc}`;
}

export function whatsappHrefWithText(phone: string, text: string): string {
  const parsed = normalizeUsPhone(phone);
  const digits = parsed?.waDigits || digitsOnly(phone);
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}

export function normalizeSenderEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidSenderEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeSenderEmail(value));
}

/** Gmail and googlemail.com are always Google. Other domains are Google Workspace only when marked. */
export function isGoogleSender(email: string, isGoogle = false): boolean {
  const domain = normalizeSenderEmail(email).split("@")[1] ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") return true;
  return isGoogle;
}

export function gmailComposeHref(input: { authuser: string; emails: string[]; subject: string; body: string }): string {
  const params = new URLSearchParams({
    authuser: input.authuser,
    view: "cm",
    fs: "1",
    su: input.subject,
    body: input.body,
  });
  if (input.emails.length === 1) params.set("to", input.emails[0]!);
  else if (input.emails.length) params.set("bcc", input.emails.join(","));
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function openEmailHref(input: {
  from?: string;
  isGoogle?: boolean;
  emails: string[];
  subject: string;
  body: string;
}): { href: string; google: boolean } {
  const from = input.from?.trim() ?? "";
  const google = Boolean(from) && isGoogleSender(from, input.isGoogle);
  if (google) {
    return { href: gmailComposeHref({ authuser: from, emails: input.emails, subject: input.subject, body: input.body }), google: true };
  }
  return { href: mailtoBccHref({ emails: input.emails, subject: input.subject, body: input.body }), google: false };
}

export const GOOGLE_VOICE_MESSAGES_URL = "https://voice.google.com/u/0/messages";

/** Clipboard text for Google Voice: the recipient number, then the message. */
export function googleVoiceCopy(number: string, message: string): string {
  return [number.trim(), message.trim()].filter(Boolean).join("\n\n");
}
