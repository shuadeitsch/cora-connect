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
import type { AppData, HouseholdView, PreplannerEntry } from "@/lib/types";

export function PreplannerView({ data }: { data: AppData }) {
  const announce = useUndoToast();
  const practice = usePractice();
  const [editing, setEditing] = useState<PreplannerEntry | null>(null);
  const [pending, start] = useTransition();
  const canChange = data.viewer.canEdit || data.viewer.canLogVisit;
  const byId = useMemo(() => new Map(data.households.map((household) => [household.id, household])), [data.households]);
  const entries = useMemo(
    () =>
      (data.preplannerEntries ?? [])
        .slice()
        .sort((a, b) => preplannerSortKey(a.requestedDate, a.requestedTime).localeCompare(preplannerSortKey(b.requestedDate, b.requestedTime)) || a.createdAt.localeCompare(b.createdAt)),
    [data.preplannerEntries],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Pre-planner"
        crumb="Pre-planner"
        description="When a contact says they are ready for a visit, add them here with the date and time they asked for. Those requests also show up on that day in the Daily planner."
      />
      {!entries.length ? (
        <p className="panel rounded-3xl px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing in the Pre-planner yet. Open a contact and choose Pre-planner when they say they are ready for a visit.
        </p>
      ) : (
        <ul className="grid gap-3">
          {entries.map((entry) => {
            const household = byId.get(entry.householdId);
            return (
              <li key={entry.id} className="panel rounded-3xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading text-lg font-semibold text-foreground">
                      {household ? (
                        <Link href={`/households?focus=${household.id}`} className="hover:text-primary">
                          {household.name}
                        </Link>
                      ) : "Contact no longer on your list"}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{preplannerWhen(entry.requestedDate, entry.requestedTime)}</p>
                    <p className="text-sm text-muted-foreground">Reached out by {reachedHowLabel(entry.reachedHow)}</p>
                    {household?.address ? <p className="text-sm text-muted-foreground">{household.address}</p> : null}
                    {entry.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{entry.notes}</p> : null}
                    {entry.scheduledAt ? (
                      <p className="mt-2 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">Scheduled</p>
                    ) : null}
                  </div>
                  {canChange ? (
                    <div className="flex flex-wrap gap-2">
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
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
