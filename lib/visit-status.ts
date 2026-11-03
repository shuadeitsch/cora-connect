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
  return status === "deferred" ? "Deferred" : "Completed";
}
