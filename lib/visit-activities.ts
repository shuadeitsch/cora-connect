import { VISIT_ACTIVITIES, normalizeActivity } from "@/lib/constants";
import type { ContactVisit, Household, User } from "@/lib/types";
import { sameState } from "@/lib/constants";

export { VISIT_ACTIVITIES, normalizeActivity };

export type ActivityCountRow = { label: string; count: number; kind: "builtin" | "writein" | "total" | "visits" };

/** Count completed visits that include each activity, scoped for the viewer.
 * Always returns one row per built-in activity (0 if none), a Write-in row, and a Total. */
export function activityCountsFor(
  visits: ContactVisit[],
  households: Household[],
  viewer: User,
  filters?: { state?: string; projectId?: string },
): ActivityCountRow[] {
  const houseById = new Map(households.map((h) => [h.id, h]));
  const counts = new Map<string, number>();
  let visitCount = 0;
  for (const visit of visits) {
    if (visit.status !== "completed") continue;
    const house = houseById.get(visit.householdId);
    if (!house) continue;
    if (filters?.state && filters.state !== "ALL" && !sameState(house.state, filters.state)) continue;
    if (filters?.projectId && filters.projectId !== "ALL" && house.projectId !== filters.projectId) continue;
    if (viewer.role === "bochur" && viewer.projectId && house.projectId && house.projectId !== viewer.projectId && !filters?.projectId) continue;
    visitCount += 1;
    for (const raw of visit.activities ?? []) {
      const label = normalizeActivity(raw);
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const builtIn = VISIT_ACTIVITIES as readonly string[];
  const rows: ActivityCountRow[] = builtIn.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
    kind: "builtin",
  }));
  let writeIn = 0;
  for (const [label, count] of counts) {
    if (!builtIn.includes(label)) writeIn += count;
  }
  rows.push({ label: "Write-in", count: writeIn, kind: "writein" });
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  rows.push({ label: "Total", count: total, kind: "total" });
  return rows;
}

/** Completed visit count under the same filters (for the Visits tile). */
export function completedVisitCount(
  visits: ContactVisit[],
  households: Household[],
  viewer: User,
  filters?: { state?: string; projectId?: string },
): number {
  const houseById = new Map(households.map((h) => [h.id, h]));
  let n = 0;
  for (const visit of visits) {
    if (visit.status !== "completed") continue;
    const house = houseById.get(visit.householdId);
    if (!house) continue;
    if (filters?.state && filters.state !== "ALL" && !sameState(house.state, filters.state)) continue;
    if (filters?.projectId && filters.projectId !== "ALL" && house.projectId !== filters.projectId) continue;
    if (viewer.role === "bochur" && viewer.projectId && house.projectId && house.projectId !== viewer.projectId && !filters?.projectId) continue;
    n += 1;
  }
  return n;
}
