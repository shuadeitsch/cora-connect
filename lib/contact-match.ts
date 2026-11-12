import { projectLabel } from "@/lib/constants";
import { isRealVisit } from "@/lib/visited";
import { visitStatusGroup, type VisitStatusGroup } from "@/lib/visit-status";

export function contactHasEmail(household: { people: { email?: string | null }[] }): boolean {
  return household.people.some((person) => Boolean(person.email?.trim()));
}

export function contactHasPhone(household: {
  people: { phone?: string | null; phone2?: string | null; phone3?: string | null }[];
}): boolean {
  return household.people.some((person) =>
    [person.phone, person.phone2, person.phone3].some((value) => Boolean(value?.trim())),
  );
}

export type ContactMatchFilters = {
  hasEmail?: boolean;
  hasPhone?: boolean;
  visitCompleted?: boolean;
  visitDeferred?: boolean;
  visitNotVisited?: boolean;
  seasons?: string[];
  tagsOn?: boolean;
  tag?: string;
  duplicates?: boolean;
  shliachDeleted?: boolean;
};

/** Status filters are OR: Completed, Deferred, Not visited. Other types AND with this. */
export function matchesVisitStatusFilters(
  visits: { visited: string; status?: "completed" | "deferred" | null }[] | undefined,
  filters: Pick<ContactMatchFilters, "visitCompleted" | "visitDeferred" | "visitNotVisited" | "seasons">,
): boolean {
  const seasons = (filters.seasons ?? []).filter(Boolean);
  const statusOn = Boolean(filters.visitCompleted || filters.visitDeferred || filters.visitNotVisited);
  if (!statusOn && !seasons.length) return true;
  const group: VisitStatusGroup = visitStatusGroup(visits, seasons.length ? seasons : undefined);
  if (!statusOn) {
    // A season alone means "has a real visit in one of these seasons".
    return group !== "not_visited";
  }
  if (group === "visited" && filters.visitCompleted) return true;
  if (group === "deferred" && filters.visitDeferred) return true;
  if (group === "not_visited" && filters.visitNotVisited) return true;
  return false;
}

export function compareHasEmail(
  a: { people: { email?: string | null }[]; name: string },
  b: { people: { email?: string | null }[]; name: string },
): number {
  return Number(contactHasEmail(b)) - Number(contactHasEmail(a)) || a.name.localeCompare(b.name);
}

export function compareHasPhone(
  a: { people: { phone?: string | null; phone2?: string | null; phone3?: string | null }[]; name: string },
  b: { people: { phone?: string | null; phone2?: string | null; phone3?: string | null }[]; name: string },
): number {
  return Number(contactHasPhone(b)) - Number(contactHasPhone(a)) || a.name.localeCompare(b.name);
}

export { projectLabel, isRealVisit };
