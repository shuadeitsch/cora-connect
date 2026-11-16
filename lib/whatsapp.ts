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
