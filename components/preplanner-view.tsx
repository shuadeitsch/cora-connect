"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PreplannerDialog } from "@/components/preplanner-dialog";
import { usePractice } from "@/components/practice-provider";
import { Button } from "@/components/ui/button";
import { useUndoToast } from "@/components/undo-toast";
import { deletePreplannerEntryAction } from "@/lib/actions";
import { preplannerSortKey, preplannerWhen, reachedHowLabel } from "@/lib/preplanner";
import type { AppData, HouseholdView, PreplannerEntry, PreplannerStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PreplannerView({ data }: { data: AppData }) {
  const announce = useUndoToast();
  const practice = usePractice();
  const [tab, setTab] = useState<PreplannerStage>("reached_out");
  const [editing, setEditing] = useState<PreplannerEntry | null>(null);
  const [confirming, setConfirming] = useState<PreplannerEntry | null>(null);
  const [pending, start] = useTransition();
  const canChange = data.viewer.canEdit || data.viewer.canLogVisit;
  const byId = useMemo(() => new Map(data.households.map((household) => [household.id, household])), [data.households]);
  const entries = data.preplannerEntries ?? [];
  const reached = entries.filter((entry) => entry.stage !== "confirmed");
  const confirmed = entries.filter((entry) => entry.stage === "confirmed");
  const shown = (tab === "confirmed" ? confirmed : reached)
    .slice()
    .sort((a, b) => {
      if (tab === "confirmed") {
        return preplannerSortKey(a.requestedDate, a.requestedTime).localeCompare(preplannerSortKey(b.requestedDate, b.requestedTime)) || a.createdAt.localeCompare(b.createdAt);
      }
      return preplannerSortKey(a.reachedDate, a.reachedTime).localeCompare(preplannerSortKey(b.reachedDate, b.reachedTime)) || a.createdAt.localeCompare(b.createdAt);
    });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Pre-planner"
        crumb="Pre-planner"
        description="Log every contact you reached, then confirm a visit when a date and time are set. Confirmed visits also show up on that day in the Daily planner."
      />
      <div className="mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-full border bg-card p-1" role="tablist" aria-label="Pre-planner stages">
        <button type="button" role="tab" aria-selected={tab === "reached_out"} className={cn("h-10 rounded-full px-3.5 text-sm font-medium", tab === "reached_out" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")} onClick={() => setTab("reached_out")}>
          Reached out ({reached.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === "confirmed"} className={cn("h-10 rounded-full px-3.5 text-sm font-medium", tab === "confirmed" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")} onClick={() => setTab("confirmed")}>
          Confirmed visits ({confirmed.length})
        </button>
      </div>
      {!shown.length ? (
        <p className="panel rounded-3xl px-4 py-10 text-center text-sm text-muted-foreground">
          {tab === "confirmed"
            ? "No confirmed visits yet. Open a Reached-out entry and choose Confirm visit when a date and time are set."
            : "Nothing in Reached out yet. Open a contact and choose Pre-planner after you reach them."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((entry) => {
            const household = byId.get(entry.householdId);
            const projectName = data.projects.find((project) => project.id === entry.projectId)?.name;
            return (
              <li key={entry.id} className="panel rounded-3xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading text-lg font-semibold text-foreground">
                      {household ? <Link href={`/households?focus=${household.id}`} className="hover:text-primary">{household.name}</Link> : "Contact no longer on your list"}
                    </p>
                    {entry.reachedDate ? (
                      <p className="mt-1 text-sm text-foreground">Reached {preplannerWhen(entry.reachedDate, entry.reachedTime)}</p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      Reached by {reachedHowLabel(entry.reachedHow)}
                      {entry.followUpHow ? ` · Follow up by ${reachedHowLabel(entry.followUpHow)}` : ""}
                    </p>
                    {entry.stage === "confirmed" && entry.requestedDate ? (
                      <p className="text-sm text-foreground">Visit {preplannerWhen(entry.requestedDate, entry.requestedTime)}</p>
                    ) : null}
                    {projectName ? <p className="text-sm text-muted-foreground">{projectName}</p> : null}
                    {household?.address ? <p className="text-sm text-muted-foreground">{household.address}</p> : null}
                    {entry.notesLog?.length ? (
                      <ol className="mt-2 grid gap-1.5">
                        {entry.notesLog.map((item, index) => (
                          <li key={`${item.at}-${index}`} className="text-sm">
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              {item.by ? ` · ${item.by}` : ""}
                              {": "}
                            </span>
                            <span className="whitespace-pre-wrap text-foreground">{item.text}</span>
                          </li>
                        ))}
                      </ol>
                    ) : entry.notes ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{entry.notes}</p>
                    ) : null}
                    {entry.scheduledAt ? (
                      <p className="mt-2 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">Scheduled</p>
                    ) : null}
                  </div>
                  {canChange ? (
                    <div className="flex flex-wrap gap-2">
                      {entry.stage !== "confirmed" ? (
                        <Button type="button" className="min-h-11 rounded-full" onClick={() => setConfirming(entry)} disabled={pending}>
                          Confirm visit
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setEditing(entry)} disabled={pending}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 rounded-full text-red-600"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm("Remove this from the Pre-planner?")) return;
                          start(async () => {
                            if (practice.active) {
                              announce({ ok: true }, "Removed in practice mode");
                              return;
                            }
                            const result = await deletePreplannerEntryAction(entry.id);
                            announce(result, "Removed from the Pre-planner");
                          });
                        }}
                      >
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <PreplannerDialog
        open={Boolean(editing)}
        households={editing ? ([byId.get(editing.householdId)].filter(Boolean) as HouseholdView[]) : []}
        initial={editing}
        data={data}
        mode="edit"
        onClose={() => setEditing(null)}
      />
      <PreplannerDialog
        open={Boolean(confirming)}
        households={confirming ? ([byId.get(confirming.householdId)].filter(Boolean) as HouseholdView[]) : []}
        initial={confirming}
        data={data}
        mode="confirm"
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}
