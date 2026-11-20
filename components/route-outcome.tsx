"use client";

import { useMemo } from "react";
import { SummerExcludeToggle, type ContactFilterState } from "@/components/contact-filters";
import { latestOutcome, outcomeText, type OutcomeFilter, type PastOutcome } from "@/lib/visit-outcome";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRouteProject } from "@/lib/route-overlap";
import { SummerDefaultNote, SummerDefaultPrompt } from "@/components/summer-default-ui";

/** Most recent Completed/Deferred outcome per contact, from the visit history. */
export function useOutcomes(data: AppData) {
  return useMemo(() => {
    const map = new Map<string, PastOutcome | null>();
    for (const household of data.households) map.set(household.id, latestOutcome(household.contactVisits));
    return map;
  }, [data.households]);
}

export const OUTCOME_COLORS = { completed: "#16a34a", deferred: "#c2410c" } as const;

export function OutcomeBadge({ outcome, className }: { outcome: PastOutcome | null | undefined; className?: string }) {
  if (!outcome) return null;
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex w-fit max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        outcome.status === "completed"
          ? "bg-green-600/15 text-green-800 ring-green-600/35 dark:bg-green-500/20 dark:text-green-200"
          : "bg-orange-600/15 text-orange-800 ring-orange-600/35 dark:bg-orange-500/20 dark:text-orange-200",
        className,
      )}
    >
      {outcomeText(outcome)}
    </span>
  );
}

/** For a city: how many of its contacts were last Completed or Deferred. */
export function OutcomeSummary({ ids, outcomes }: { ids: string[]; outcomes: Map<string, PastOutcome | null> }) {
  let completed = 0;
  let deferred = 0;
  for (const id of ids) {
    const status = outcomes.get(id)?.status;
    if (status === "completed") completed += 1;
    else if (status === "deferred") deferred += 1;
  }
  if (!completed && !deferred) return null;
  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {completed ? <span className="rounded-full bg-green-600/15 px-2 py-0.5 text-[11px] font-medium text-green-800 ring-1 ring-inset ring-green-600/35 dark:text-green-200">{completed} completed</span> : null}
      {deferred ? <span className="rounded-full bg-orange-600/15 px-2 py-0.5 text-[11px] font-medium text-orange-800 ring-1 ring-inset ring-orange-600/35 dark:text-orange-200">{deferred} deferred</span> : null}
    </span>
  );
}

export function OutcomeLegend({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)} aria-label="Map key">
      <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-full border border-white shadow" style={{ background: OUTCOME_COLORS.completed }} /> Completed</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-full border border-white shadow" style={{ background: OUTCOME_COLORS.deferred }} /> Deferred</span>
    </span>
  );
}

const CHOICES: { value: OutcomeFilter; label: string }[] = [
  { value: "all", label: "Show all past visits" },
  { value: "hide_completed", label: "Hide completed" },
  { value: "hide_deferred", label: "Hide deferred" },
  { value: "only_deferred", label: "Only deferred" },
];

/** Exclude summer homes + past-visit filter, both remembered on this device. */
export function RouteListOptions({ ctl, data, legend = false }: { ctl: ContactFilterState; data: AppData; legend?: boolean }) {
  const { projectId } = useRouteProject(data);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="basis-full"><SummerDefaultPrompt data={data} projectId={projectId} state={ctl.filters.state} /></div>
      <SummerExcludeToggle ctl={ctl} data={data} />
      <SummerDefaultNote data={data} projectId={projectId} state={ctl.filters.state} />
      <select
        className="h-10 max-w-full rounded-full border border-border bg-card px-3 text-sm"
        value={ctl.filters.outcome}
        aria-label="Past visits"
        onChange={(event) => ctl.toggle("outcome", event.target.value as OutcomeFilter)}
      >
        {CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select>
      {legend ? <OutcomeLegend /> : null}
    </div>
  );
}
