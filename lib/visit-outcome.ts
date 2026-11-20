import { isRealVisit } from "@/lib/visited";

export type PastOutcome = { status: "completed" | "deferred"; date: string | null };
export type OutcomeFilter = "all" | "hide_completed" | "hide_deferred" | "only_deferred";

type VisitLike = { visited: string; status?: "completed" | "deferred" | null; visitDate?: string | null; createdAt?: string };

/**
 * The most recent real visit decides: Deferred stays Deferred until a later visit is Completed.
 * A real visit with no stored status counts as Completed, the same as the contact list does.
 */
export function latestOutcome(visits: VisitLike[] | undefined): PastOutcome | null {
  let best: { status: "completed" | "deferred"; date: string | null; key: string } | null = null;
  for (const visit of visits ?? []) {
    if (!isRealVisit(visit.visited)) continue;
    const date = (visit.visitDate || visit.createdAt || "").slice(0, 10) || null;
    const key = `${date ?? ""}|${visit.createdAt ?? ""}`;
    if (!best || key > best.key) best = { status: visit.status === "deferred" ? "deferred" : "completed", date, key };
  }
  return best ? { status: best.status, date: best.date } : null;
}

export function outcomeAllowed(outcome: PastOutcome | null, filter: OutcomeFilter): boolean {
  if (filter === "hide_completed") return outcome?.status !== "completed";
  if (filter === "hide_deferred") return outcome?.status !== "deferred";
  if (filter === "only_deferred") return outcome?.status === "deferred";
  return true;
}

export function outcomeText(outcome: PastOutcome): string {
  const label = outcome.status === "deferred" ? "Deferred" : "Completed";
  if (!outcome.date) return label;
  const [year, month, day] = outcome.date.split("-").map(Number);
  if (!year || !month || !day) return label;
  const now = new Date();
  const when = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year !== now.getFullYear() ? { year: "numeric" as const } : {}), timeZone: "UTC" });
  return `${label} ${when}`;
}
