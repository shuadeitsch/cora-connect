import { toE164, type ContactablePerson } from "@/lib/messaging";
import type { Person } from "@/lib/types";

/** Best number for WhatsApp: the WhatsApp field, then any phone on the person. */
export function whatsappNumberFor(person: Pick<Person, "whatsapp" | "phone" | "phone2" | "phone3"> | ContactablePerson): string {
  const row = person as { whatsapp?: string; phone?: string; phone2?: string; phone3?: string };
  return (row.whatsapp ?? "").trim() || (row.phone ?? "").trim() || (row.phone2 ?? "").trim() || (row.phone3 ?? "").trim();
}

/** E.164 digits with no plus, for wa.me links. */
export function whatsappMeDigits(phone: string): string | null {
  const e164 = toE164(phone);
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export function whatsappMeLink(phone: string, text: string): string | null {
  const digits = whatsappMeDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "rabbi", "rav", "prof", "professor", "mx", "rev", "hon", "judge", "sir"]);

const CONJUNCTIONS = new Set(["and", "&", "+"]);
const DOTTED_TITLES = new Set(["mr", "mrs", "ms", "dr", "prof", "rev", "hon", "mx"]);

function cleanToken(raw: string): string {
  return raw.replace(/^[^\p{L}&+]+|[^\p{L}&+]+$/gu, "");
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function isGoodFirst(word: string): boolean {
  return word.length >= 2 && !TITLES.has(word.toLowerCase());
}

function canonicalTitle(word: string): string {
  const key = word.toLowerCase().replace(/[^a-z]/g, "");
  const base = titleCase(key);
  return DOTTED_TITLES.has(key) ? `${base}.` : base;
}

/**
 * Name used in a greeting, the same everywhere (email, text, WhatsApp, tap-to-send, WhatsApp template {{1}}).
 * - First names win: "Mrs. Ruth Gordon" -> Ruth, "Adam & Isabelle Johnson" -> Adam and Isabelle, "Mr. & Mrs. Eric Lusty" -> Eric.
 * - Titles + surname only: "Mr. and Mrs. Smith" -> Mr. and Mrs. Smith, "Dr. and Dr. Cohen" -> Dr. and Dr. Cohen, "Dr. Cohen" -> Dr. Cohen.
 * - Families: "The Cohen Family" -> Cohen family.
 * - "there" only when there is no usable name at all.
 */
export function greetingFirstName(name: string): string {
  const raw = name.trim();
  if (!raw || /[@\d]/.test(raw)) return "there";
  if (/\b(estate|trust)\b/i.test(raw)) return "there";
  const family = raw.match(/^(?:the\s+)?(.+?)\s+(?:family|household)$/i);
  if (family) {
    const surname = family[1].trim().split(/\s+/).map(titleCase).join(" ");
    return /\b(and|&)\b/i.test(surname) ? surname.replace(/\s*&\s*/g, " and ") + " family" : `${surname} family`;
  }
  if (/\b(family|household)\b/i.test(raw)) return "there";
  const tokens = raw.replace(/\s*[&+]\s*/g, " & ").split(/\s+/).map((part) => {
    const lower = part.toLowerCase().replace(/[^a-z&+]/g, "");
    if (part === "&" || part === "+" || lower === "and") return "&";
    return cleanToken(part);
  }).filter(Boolean);
  const isTitle = (token: string) => TITLES.has(token.toLowerCase().replace(/[^a-z]/g, ""));
  const titles: string[] = []; // titles and "and", in order
  const groups: string[][] = [[]];
  for (const token of tokens) {
    if (CONJUNCTIONS.has(token.toLowerCase())) {
      titles.push("and");
      if (groups[groups.length - 1].length) groups.push([]);
      continue;
    }
    if (isTitle(token)) { titles.push(canonicalTitle(token)); continue; }
    groups[groups.length - 1].push(token);
  }
  const parts = groups.filter((group) => group.length);
  if (!parts.length) return "there";
  const firstA = parts[0][0];
  // Only a surname after the titles: greet with the titles ("Mr. and Mrs. Smith").
  if (parts.length === 1 && parts[0].length === 1 && titles.some((t) => t !== "and")) {
    const phrase: string[] = [];
    for (const t of titles) {
      if (t === "and" && (!phrase.length || phrase[phrase.length - 1] === "and")) continue;
      phrase.push(t);
    }
    while (phrase[phrase.length - 1] === "and") phrase.pop();
    return `${phrase.join(" ")} ${titleCase(firstA)}`;
  }
  const fmt = (group: string[]) => group.map((w) => (w.length === 1 ? `${w.toUpperCase()}.` : titleCase(w))).join(" ");
  if (!isGoodFirst(firstA) && parts[0].length === 1 && parts.length >= 2) {
    // Two initials sharing a surname ("S. & G. Wayne-Workman"): greet them both, never just "S.".
    return parts.map(fmt).join(" and ");
  }
  if (!isGoodFirst(firstA)) {
    // An initial like "J. Smith": use the whole name rather than "there".
    return parts[0].map((w) => (w.length === 1 ? `${w.toUpperCase()}.` : titleCase(w))).join(" ");
  }
  if (parts.length >= 2 && isGoodFirst(parts[1][0])) return `${titleCase(firstA)} and ${titleCase(parts[1][0])}`;
  return titleCase(firstA);
}

/** The best mobile-looking WhatsApp number for a contact: the WhatsApp field first, then the first valid phone in order. */
export function bestWhatsAppNumber(person: { whatsapp?: string; phone?: string; phone2?: string; phone3?: string; extraPhones?: string[] }): string {
  const list = [person.whatsapp, person.phone, person.phone2, person.phone3, ...(person.extraPhones ?? [])];
  for (const value of list) {
    const text = (value ?? "").trim();
    if (text && whatsappMeDigits(text)) return text;
  }
  return "";
}
