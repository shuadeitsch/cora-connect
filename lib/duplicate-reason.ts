import { emailKey, phoneKey } from "@/lib/csv";
import { namesNearlyMatch, normName } from "@/lib/import-plan";
import type { Household, Person } from "@/lib/types";

/** What we compare for a possible duplicate. Worked out on the fly; nothing is stored. */
export interface DupSide {
  household: Household;
  people: Person[];
}

function names(side: DupSide) {
  return [side.household.name, ...side.people.map((person) => person.name)].map(normName).filter(Boolean);
}

function keys(side: DupSide, pick: (person: Person) => string, key: (value: string) => string) {
  return new Set(side.people.map((person) => key(pick(person))).filter(Boolean));
}

function shares(left: Set<string>, right: Set<string>) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

/** The matching parts, strongest first, e.g. ["address", "phone", "similar name"]. */
export function matchParts(a: DupSide, b: DupSide): string[] {
  const parts: string[] = [];
  const street = normName(a.household.street);
  if (street && street === normName(b.household.street) && normName(a.household.city) === normName(b.household.city)) parts.push("address");
  if (shares(keys(a, (p) => p.phone, phoneKey), keys(b, (p) => p.phone, phoneKey))) parts.push("phone");
  if (shares(keys(a, (p) => p.email, emailKey), keys(b, (p) => p.email, emailKey))) parts.push("email");
  const an = names(a);
  const bn = names(b);
  if (an.some((name) => bn.includes(name))) parts.push("name");
  else if (an.some((name) => bn.some((other) => namesNearlyMatch(name, other)))) parts.push("similar name");
  return parts;
}

/**
 * Mendel's rule (1.8.1): flag only on same address, phone or email. A name or similar name
 * alone flags only when one side has no address to compare.
 */
export function worthFlagging(parts: string[], a: DupSide, b: DupSide) {
  if (parts.some((part) => part === "address" || part === "phone" || part === "email")) return true;
  if (!parts.length) return false;
  return !normName(a.household.street) || !normName(b.household.street);
}

const WEIGHT: Record<string, number> = { address: 50, phone: 80, email: 70, name: 60, "similar name": 40 };

export function matchScore(parts: string[]) {
  return parts.reduce((sum, part) => sum + (WEIGHT[part] ?? 0), 0);
}

function join(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "Same address and phone as", "Similar name to", or "" when nothing matches. */
export function reasonLead(parts: string[]) {
  if (!parts.length) return "";
  if (parts.length === 1 && parts[0] === "similar name") return "Similar name to";
  return `Same ${join(parts)} as`;
}
