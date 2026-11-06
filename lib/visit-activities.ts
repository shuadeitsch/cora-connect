import { VISIT_ACTIVITIES, normalizeActivity } from "@/lib/constants";
import type { ContactVisit, Household, User } from "@/lib/types";
import { sameState } from "@/lib/constants";

export { VISIT_ACTIVITIES, normalizeActivity };

/** Count completed visits that include each activity, scoped for the viewer. */
export function activityCountsFor(
  visits: ContactVisit[],
  households: Household[],
  viewer: User,
  filters?: { state?: string; projectId?: string },
): { label: string; count: number }[] {
  const houseById = new Map(households.map((h) => [h.id, h]));
  const counts = new Map<string, number>();
  for (const visit of visits) {
    if (visit.status !== "completed") continue;
    const house = houseById.get(visit.householdId);
    if (!house) continue;
    if (filters?.state && filters.state !== "ALL" && !sameState(house.state, filters.state)) continue;
    if (filters?.projectId && filters.projectId !== "ALL" && house.projectId !== filters.projectId) continue;
    // Bochur: prefer his project when no filter passed.
    if (viewer.role === "bochur" && viewer.projectId && house.projectId && house.projectId !== viewer.projectId && !filters?.projectId) continue;
    for (const raw of visit.activities ?? []) {
      const label = normalizeActivity(raw);
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const builtIn = new Set<string>(VISIT_ACTIVITIES);
  const rows = [...counts.entries()].map(([label, count]) => ({ label, count }));
  rows.sort((a, b) => {
    const ai = builtIn.has(a.label) ? 0 : 1;
    const bi = builtIn.has(b.label) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return b.count - a.count || a.label.localeCompare(b.label);
  });
  return rows;
}
