export type VisitProgress = "completed" | "deferred";

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
