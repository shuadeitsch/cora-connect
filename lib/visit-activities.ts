import { VISIT_ACTIVITIES, normalizeActivity, sameState } from "@/lib/constants";
import { isTaggedContact } from "@/lib/contact-tags";
import type { ContactVisit, Household, User } from "@/lib/types";

export { VISIT_ACTIVITIES, normalizeActivity };

export type ActivityCountRow = { label: string; count: number; kind: "builtin" | "writein" | "total" | "visits" };

export type ProjectFilter = { state?: string; projectId?: string; projectName?: string };

function visitOnProject(visit: ContactVisit, house: Household, filters?: ProjectFilter) {
  const projectId = filters?.projectId;
  if (!projectId || projectId === "ALL") return true;
  if (visit.projectId === projectId) return true;
  if (house.projectId === projectId) return true;
  const name = filters?.projectName?.trim().toLowerCase();
  if (name && visit.visited.trim().toLowerCase() === name) return true;
  return false;
}

function houseInState(house: Household, state?: string) {
  if (!state || state === "ALL") return true;
  return sameState(house.state, state);
}

/** Count completed visits that include each activity, scoped for the viewer.
 * Always returns one row per built-in activity (0 if none) and a Total. */
export function activityCountsFor(
  visits: ContactVisit[],
  households: Household[],
  viewer: User,
  filters?: ProjectFilter,
): ActivityCountRow[] {
  const houseById = new Map(households.map((h) => [h.id, h]));
  const counts = new Map<string, number>();
  for (const visit of visits) {
    if (visit.status !== "completed") continue;
    const house = houseById.get(visit.householdId);
    if (!house) continue;
    if (house.deletedAt || house.deletedByShliachAt) continue;
    if (!houseInState(house, filters?.state)) continue;
    if (isTaggedContact(house.tags ?? [])) continue;
    if (!visitOnProject(visit, house, filters)) continue;
    if (viewer.role === "bochur" && viewer.projectId && filters?.projectId !== viewer.projectId && house.projectId && house.projectId !== viewer.projectId) {
      continue;
    }
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
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  rows.push({ label: "Total", count: total, kind: "total" });
  return rows;
}

function onProjectVisit(
  cv: { projectId?: string | null; visited: string },
  house: { projectId?: string | null },
  filters: { projectId: string; projectName?: string },
) {
  const allProjects = !filters.projectId || filters.projectId === "ALL";
  if (allProjects) return true;
  const name = filters.projectName?.trim().toLowerCase() ?? "";
  if (cv.projectId === filters.projectId) return true;
  if (house.projectId === filters.projectId) return true;
  if (name && cv.visited.trim().toLowerCase() === name) return true;
  return false;
}

/** Home Visits coverage: unique live contacts with a matching visit, out of the live book.
 *  By default, removed (not Jewish / doesn't exist) are excluded from both X and the denominator.
 *  includeRemoved=true → denominator is the full live book; every removed contact counts in X as visited.
 *  includeDeferred=false → completed only; true → completed + deferred.
 *  total is the live count (incl. removed); activeTotal = total - removed. */
export function visitCoverage(
  households: {
    id: string;
    state: string;
    projectId?: string | null;
    tags?: string[];
    deletedAt?: string | null;
    deletedByShliachAt?: string | null;
    contactVisits: { status?: string | null; projectId?: string | null; visited: string }[];
  }[],
  filters: { state?: string; projectId: string; projectName?: string; includeDeferred?: boolean; includeRemoved?: boolean },
): {
  visited: number;
  total: number;
  percent: number;
  activeTotal: number;
  removed: number;
  denominator: number;
} {
  const includeDeferred = Boolean(filters.includeDeferred);
  const includeRemoved = Boolean(filters.includeRemoved);
  let visited = 0;
  let total = 0;
  let removed = 0;
  for (const house of households) {
    if (house.deletedAt) continue;
    if (house.deletedByShliachAt) continue;
    if (filters.state && filters.state !== "ALL" && !sameState(house.state, filters.state)) continue;
    total += 1;
    if (isTaggedContact(house.tags ?? [])) {
      removed += 1;
      // Include removed: they count in X as visited (the full live book is the denominator).
      if (includeRemoved) visited += 1;
      continue;
    }
    const hit = house.contactVisits.some((cv) => {
      const st = cv.status ?? "completed";
      if (st === "completed") {
        /* ok */
      } else if (includeDeferred && st === "deferred") {
        /* ok */
      } else {
        return false;
      }
      return onProjectVisit(cv, house, filters);
    });
    if (hit) visited += 1;
  }
  const activeTotal = total - removed;
  const denominator = includeRemoved ? total : activeTotal;
  const percent = denominator ? Math.round((visited / denominator) * 100) : 0;
  return { visited, total, percent, activeTotal, removed, denominator };
}

/** Pick current/most recent project: most recent visit activity, then name. */
export function defaultProjectId(
  projects: { id: string; name: string }[],
  households: { projectId?: string | null; contactVisits: { projectId?: string | null; visited: string; visitDate?: string | null; createdAt?: string | null; status?: string | null }[] }[],
  locked?: string | null,
): string {
  if (locked && projects.some((p) => p.id === locked)) return locked;
  if (!projects.length) return "";
  const score = new Map<string, string>(); // projectId -> latest visit date
  const nameToId = new Map(projects.map((p) => [p.name.trim().toLowerCase(), p.id]));
  for (const house of households) {
    for (const cv of house.contactVisits) {
      if (cv.status && cv.status !== "completed") continue;
      let pid = cv.projectId || house.projectId || null;
      if (!pid) pid = nameToId.get(cv.visited.trim().toLowerCase()) ?? null;
      if (!pid) continue;
      const when = (cv.visitDate || cv.createdAt || "").slice(0, 10);
      const prev = score.get(pid) ?? "";
      if (when >= prev) score.set(pid, when);
    }
  }
  const ranked = [...projects].sort((a, b) => {
    const da = score.get(a.id) ?? "";
    const db = score.get(b.id) ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.name.localeCompare(a.name);
  });
  return ranked[0]?.id ?? projects[0].id;
}

/** Latest completed/deferred status per contact for a project (or all). Skips removed-tagged contacts. */
export function visitStatusSplit(
  households: {
    id: string;
    state: string;
    projectId?: string | null;
    tags?: string[];
    contactVisits: { status?: string | null; projectId?: string | null; visited: string; visitDate?: string | null; createdAt?: string | null }[];
  }[],
  filters: { state?: string; projectId: string; projectName?: string },
): { completed: number; deferred: number } {
  let completed = 0;
  let deferred = 0;
  for (const house of households) {
    if (filters.state && filters.state !== "ALL" && !sameState(house.state, filters.state)) continue;
    if (isTaggedContact(house.tags ?? [])) continue;
    const ranked = [...house.contactVisits]
      .filter((cv) => {
        const st = cv.status ?? "completed";
        if (st !== "completed" && st !== "deferred") return false;
        return onProjectVisit(cv, house, filters);
      })
      .sort((a, b) => {
        const da = (a.visitDate || a.createdAt || "").toString();
        const db = (b.visitDate || b.createdAt || "").toString();
        return db.localeCompare(da);
      });
    const latest = ranked[0];
    if (!latest) continue;
    if ((latest.status ?? "completed") === "deferred") deferred += 1;
    else completed += 1;
  }
  return { completed, deferred };
}
