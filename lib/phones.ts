/** Every number saved on a person, in order: phone (primary), phone2, phone3, then extraPhones (4th number onward). */
export function savedPhones(person: { phone?: string | null; phone2?: string | null; phone3?: string | null; extraPhones?: string[] | null }): string[] {
  return [person.phone, person.phone2, person.phone3, ...(person.extraPhones ?? [])].map((value) => (value ?? "").trim()).filter(Boolean);
}

/** Splits an ordered list of numbers back into the fixed columns and the extra list. */
export function splitPhones(list: string[]): { phone: string; phone2: string; phone3: string; extraPhones: string[] } {
  const clean = list.map((value) => value.trim()).filter(Boolean);
  return { phone: clean[0] ?? "", phone2: clean[1] ?? "", phone3: clean[2] ?? "", extraPhones: clean.slice(3) };
}
