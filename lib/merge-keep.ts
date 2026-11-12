import { phoneKey, emailKey } from "@/lib/csv";
import { appendGrokNote } from "@/lib/visit-notes";
import { appendUniqueAddress, parseExtraAddresses, type ExtraAddress } from "@/lib/extra-addresses";
import type { ContactSnapshot, Household, Person } from "@/lib/types";

export type MergeKeepResult = {
  household: Household;
  people: Person[];
  /** Plain descriptions of what was copied, or empty if the survivor already had everything. */
  restored: string[];
};

function phonesOf(people: Person[]) {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    for (const value of [person.phone, person.phone2, person.phone3]) {
      const key = phoneKey(value ?? "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      values.push(value.trim());
    }
  }
  return { values, keys: seen };
}

function fillPhones(target: Person, incoming: string[]): { person: Person; added: string[] } {
  const slots: Array<"phone" | "phone2" | "phone3"> = ["phone", "phone2", "phone3"];
  const next = { ...target };
  const have = new Set([phoneKey(next.phone), phoneKey(next.phone2), phoneKey(next.phone3)].filter(Boolean));
  const added: string[] = [];
  for (const value of incoming) {
    const key = phoneKey(value);
    if (!key || have.has(key)) continue;
    const slot = slots.find((name) => !phoneKey(next[name]));
    if (!slot) break;
    next[slot] = value;
    have.add(key);
    added.push(slot === "phone" ? "phone" : slot === "phone2" ? "phone 2" : "phone 3");
  }
  return { person: next, added };
}

/**
 * Copy values from the losing card that the surviving card does not already have.
 * Never overwrites. Visits are moved separately.
 */
export function keepLostMergeValues(source: ContactSnapshot, target: ContactSnapshot, options?: { note?: string }): MergeKeepResult {
  const restored: string[] = [];
  const household: Household = {
    ...target.household,
    extraAddresses: parseExtraAddresses(target.household.extraAddresses),
    tags: [...target.household.tags],
    categoryIds: [...target.household.categoryIds],
    customFields: { ...target.household.customFields },
  };

  const incomingAddress: ExtraAddress = {
    street: source.household.street ?? "",
    city: source.household.city ?? "",
    state: source.household.state ?? "",
    zip: source.household.zip ?? "",
    label: "",
  };
  const before = household.extraAddresses?.length ?? 0;
  household.extraAddresses = appendUniqueAddress(household.extraAddresses, incomingAddress, target.household);
  if ((household.extraAddresses?.length ?? 0) > before) restored.push("address");

  for (const extra of parseExtraAddresses(source.household.extraAddresses)) {
    const prev = household.extraAddresses?.length ?? 0;
    household.extraAddresses = appendUniqueAddress(household.extraAddresses, extra, target.household);
    if ((household.extraAddresses?.length ?? 0) > prev && !restored.includes("address")) restored.push("address");
  }

  const people = target.people.map((person) => ({ ...person }));
  if (!people.length && source.people.length) {
    people.push(...source.people.map((person) => ({ ...person, householdId: target.household.id })));
    restored.push("people");
  } else if (people[0]) {
    const incoming = phonesOf(source.people).values;
    const filled = fillPhones(people[0], incoming);
    people[0] = filled.person;
    restored.push(...filled.added);
    const sourceEmail = source.people.map((person) => person.email).find((value) => emailKey(value ?? ""));
    if (sourceEmail && !emailKey(people[0].email ?? "")) {
      people[0] = { ...people[0], email: sourceEmail.trim() };
      restored.push("email");
    }
  }

  const sourceNotes = (source.household.notes ?? "").trim();
  if (sourceNotes) {
    const current = household.notes ?? "";
    const already = current.includes(sourceNotes);
    if (!already) {
      household.notes = current.trim() ? `${current.replace(/\s+$/, "")}\n${sourceNotes}` : sourceNotes;
      restored.push("notes");
    }
  }

  for (const tag of source.household.tags ?? []) {
    if (tag && !household.tags.includes(tag)) {
      household.tags.push(tag);
      if (!restored.includes("tags")) restored.push("tags");
    }
  }

  if (restored.length && options?.note) {
    household.notes = appendGrokNote(household.notes, options.note);
  }

  return { household, people, restored };
}
