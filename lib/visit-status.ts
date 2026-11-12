import { projectLabel } from "@/lib/constants";
import { isRealVisit } from "@/lib/visited";

export type VisitProgress = "completed" | "deferred";

/** How a contact ranks when the list is ordered or filtered by visits. */
export type VisitStatusGroup = "visited" | "deferred" | "not_visited";

/** Blank or unrecognized text is Completed. */
export function parseVisitStatus(value: string): { status: VisitProgress; warning: string } {
  const raw = value.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return { status: "completed", warning: "" };
  if (["completed", "complete", "done"].includes(raw)) return { status: "completed", warning: "" };
  if (["deferred", "defer", "deferred visit"].includes(raw)) return { status: "deferred", warning: "" };
  return { status: "completed", warning: `“${value.trim()}” is not Completed or Deferred, so the visit is Completed.` };
}

export function visitStatusLabel(status: VisitProgress | null | undefined): string {
  return status === "deferred" ? "Deferred" : status === "completed" ? "Completed" : "No status";
}

/**
 * Visit chip colors show only the visit status, for every project: green = completed, red = deferred,
 * gray = no status saved. Reactions use their own colors and never these greens and reds.
 */
export function visitStatusChip(status: VisitProgress | null | undefined) {
  if (status === "completed") {
    return { label: "Visited", className: "bg-green-600/15 text-green-800 ring-1 ring-inset ring-green-600/35 dark:bg-green-500/20 dark:text-green-200 dark:ring-green-400/40" };
  }
  if (status === "deferred") {
    return { label: "Deferred", className: "bg-red-600/15 text-red-800 ring-1 ring-inset ring-red-600/35 dark:bg-red-500/20 dark:text-red-200 dark:ring-red-400/40" };
  }
  return { label: "No status", className: "bg-muted text-foreground ring-1 ring-inset ring-border" };
}

type VisitForGroup = { visited: string; status?: "completed" | "deferred" | null };

/**
 * Rank a contact for "by visited" lists: actually visited (Completed, or a real visit with no status),
 * then Deferred, then never visited. Removed visits should already be omitted from `visits`.
 * When `season` is set, only visits in that season count.
 */
export function visitStatusGroup(visits: VisitForGroup[] | undefined, season?: string | string[]): VisitStatusGroup {
  const seasons = !season ? [] : Array.isArray(season) ? season.filter(Boolean) : [season];
  const scoped = (visits ?? []).filter((visit) => {
    if (!isRealVisit(visit.visited)) return false;
    if (seasons.length && !seasons.includes(projectLabel(visit.visited))) return false;
    return true;
  });
  if (scoped.some((visit) => visit.status !== "deferred")) return "visited";
  if (scoped.some((visit) => visit.status === "deferred")) return "deferred";
  return "not_visited";
}

const GROUP_RANK: Record<VisitStatusGroup, number> = { visited: 0, deferred: 1, not_visited: 2 };

export function compareVisitStatusGroup(
  a: { contactVisits?: VisitForGroup[] },
  b: { contactVisits?: VisitForGroup[] },
  season?: string | string[],
): number {
  return GROUP_RANK[visitStatusGroup(a.contactVisits, season)] - GROUP_RANK[visitStatusGroup(b.contactVisits, season)];
}

/** A specific season name, or undefined when the filter is All visits / Not visited / unset. */
export function visitFilterSeason(visited: string | undefined, anyValue: string, noneValue: string): string | undefined {
  if (!visited || visited === anyValue || visited === noneValue) return undefined;
  return visited;
}
