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

function isProbablyDoesntExist(folded: string): boolean {
  const words = folded.split(" ").filter(Boolean);
  const probably = words.some((word) => close(word, "probably", 2));
  const doesnt = words.includes("doesnt") || words.includes("dosent") || words.includes("doesent") || (words.includes("does") && words.includes("not"));
  const exist = words.some((word) => word === "exist" || word === "exists" || close(word, "exist", 1));
  return probably && doesnt && exist;
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

export function isTaggedContact(tags: string[]): boolean {
  return tags.some((tag) => canonicalTag(tag));
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
