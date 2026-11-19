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

/** First name for a greeting. Skips titles (Mrs. Ruth Gordon -> Ruth); falls back to "there" when there is no usable first name. */
export function greetingFirstName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && TITLES.has(parts[0].toLowerCase().replace(/[^a-z]/g, ""))) parts.shift();
  const first = (parts[0] ?? "").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!first || first.length < 2 || TITLES.has(first.toLowerCase())) return "there";
  if (/\b(the|family|household|and|estate|trust)\b/i.test(parts.join(" ")) || /[&@\d]/.test(parts.join(" "))) return "there";
  return first.charAt(0).toUpperCase() + first.slice(1);
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
