import { normalizeState } from "@/lib/constants";

export const CONTACT_TAGS = ["Not Jewish", "Probably doesn't exist"] as const;

export type ContactTag = (typeof CONTACT_TAGS)[number];

const APOSTROPHES = /[''`´‘’‚‛′]/g;

/** Lowercase, drop quote marks, and collapse punctuation so spelling can be compared. */
export function foldTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(APOSTROPHES, "")
    .replace(/[“”"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const current = row[j] ?? 0;
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, previous + cost);
      previous = current;
    }
  }
  return row[right.length] ?? 0;
}

function close(word: string, target: string, max: number): boolean {
  return Math.abs(word.length - target.length) <= max && distance(word, target) <= max;
}

const EXIST_WORDS = ["exist", "exists", "existent", "existant", "existing", "excist", "exsist"];
const NEGATIONS = ["doesnt", "dosent", "doesent", "dosnt", "dont", "not", "non", "no", "isnt", "nt"];

/**
 * Probably doesn't exist, in any of the ways people type it: probably not existent,
 * probably non-existent, prob nonexistent, does not exist, probobly dosent exist.
 */
function isProbablyDoesntExist(folded: string): boolean {
  const words = folded.split(" ").filter(Boolean);
  const exist = words.some((word) => EXIST_WORDS.some((target) => word === target || close(word, target, 1)));
  const joined = words.some((word) => /^(non|in|un)ex[a-z]*st/.test(word));
  const negated = words.some((word) => NEGATIONS.includes(word)) || (words.includes("does") && words.includes("not"));
  return joined || (exist && negated);
}

export function canonicalTag(value: string): ContactTag | null {
  const folded = foldTag(value);
  if (!folded) return null;
  const compact = folded.replace(/ /g, "");
  if (folded === "not jewish" || folded === "non jewish" || compact === "notjewish" || compact === "nonjewish") return "Not Jewish";
  if (isProbablyDoesntExist(folded)) return "Probably doesn't exist";
  return null;
}

export function parseContactTags(value: string): { tags: ContactTag[]; unknown: string[] } {
  const tags: ContactTag[] = [];
  const unknown: string[] = [];
  for (const part of value.split(/[,;]/)) {
    const raw = part.trim();
    if (!raw) continue;
    const tag = canonicalTag(raw);
    if (!tag) {
      unknown.push(raw);
      continue;
    }
    if (!tags.includes(tag)) tags.push(tag);
  }
  return { tags, unknown };
}

/** Contacts with any of these tags stay off the main list and every other view until that tag is picked. */
export const HIDDEN_TAGS: readonly ContactTag[] = CONTACT_TAGS;

export function isTaggedContact(tags: string[]): boolean {
  return tags.some((tag) => {
    const canonical = canonicalTag(tag);
    return Boolean(canonical && HIDDEN_TAGS.includes(canonical));
  });
}

export function officialTags(tags: string[]): ContactTag[] {
  const found: ContactTag[] = [];
  for (const tag of tags) {
    const canonical = canonicalTag(tag);
    if (canonical && !found.includes(canonical)) found.push(canonical);
  }
  return found;
}

/** A blank filter matches every contact. A named tag matches the official wording, including curly apostrophes. */
export function matchesTagFilter(tags: string[], filter: string): boolean {
  const wanted = filter.trim();
  if (!wanted) return true;
  return officialTags(tags).includes(wanted as ContactTag);
}

/** Main list hides tagged contacts. A search, or the Tagged section, still shows them. */
export function showInContactList(tags: string[], query: string, section: "main" | "tagged"): boolean {
  const tagged = isTaggedContact(tags);
  if (section === "tagged") return tagged;
  if (query.trim()) return true;
  return !tagged;
}

export type RouteStopPlace = { householdId: string; city: string; state: string };

/** Tagged contacts who are stops, in the same town as a stop, or (with no town) in the same state. */
export function taggedAlongRoute<T extends { id: string; name: string; city: string; state: string; tags: string[] }>(
  households: T[],
  stops: RouteStopPlace[],
): T[] {
  if (!stops.length) return [];
  const stopIds = new Set(stops.map((stop) => stop.householdId));
  const towns = new Set(stops.map((stop) => stop.city.trim().toLowerCase()).filter(Boolean));
  const states = new Set(stops.map((stop) => normalizeState(stop.state).toLowerCase()).filter(Boolean));
  return households
    .filter((household) => {
      if (!isTaggedContact(household.tags)) return false;
      if (stopIds.has(household.id)) return true;
      const city = household.city.trim().toLowerCase();
      if (city && towns.has(city)) return true;
      if (!city && states.has(normalizeState(household.state).toLowerCase())) return true;
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Contacts tagged Not Jewish / Probably doesn't exist (off the main list). */
export function countRemovedTagged(
  households: { state: string; tags: string[] }[],
  stateFilter?: string,
): number {
  return households.filter((house) => {
    if (stateFilter && stateFilter !== "ALL") {
      const a = house.state.trim().toUpperCase();
      const b = stateFilter.trim().toUpperCase();
      const map: Record<string, string> = { MAINE: "ME", "NEW HAMPSHIRE": "NH", WISCONSIN: "WI" };
      const code = (s: string) => map[s] ?? s;
      if (code(a) !== code(b) && a !== b) return false;
    }
    return isTaggedContact(house.tags);
  }).length;
}
