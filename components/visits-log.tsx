"use client";

import { useMemo, useState } from "react";
import { VISIT_REACTIONS } from "@/lib/constants";
import { formatMedium } from "@/lib/format";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 25;

/**
 * Shliach / bochur dashboard: every visit the bochurim logged, newest first.
 * A shliach sees visits by his bochurim (and his own); a bochur only his own.
 * The contacts list is already limited to what this person may see.
 */
export function VisitsLog({ data }: { data: AppData }) {
  const { viewer } = data;
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(() => {
    const names = new Map(data.members.map((member) => [member.id, member.name]));
    names.set(viewer.id, viewer.name);
    const mine = viewer.role === "bochur"
      ? new Set([viewer.id])
      : new Set([viewer.id, ...data.members.filter((member) => member.leaderId === viewer.id).map((member) => member.id)]);
    const list = data.households.flatMap((household) => household.contactVisits
      .filter((visit) => visit.createdBy && mine.has(visit.createdBy))
      .map((visit) => ({ ...visit, household, by: names.get(visit.createdBy!) ?? "Someone" })));
    return list.sort((a, b) => (b.visitDate ?? b.createdAt).localeCompare(a.visitDate ?? a.createdAt) || b.createdAt.localeCompare(a.createdAt));
  }, [data.households, data.members, viewer]);

  return (
    <section className="panel rounded-3xl p-4" aria-label="Bochurim visits">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">{viewer.role === "bochur" ? "My visits" : "Bochurim visits"}</h2>
        <span className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "visit" : "visits"}</span>
      </div>
      {rows.length ? (
        <>
          <ul className="mt-3 divide-y divide-border">
            {rows.slice(0, shown).map((row) => {
              const reaction = VISIT_REACTIONS.find((item) => item.id === row.reaction);
              return (
                <li key={row.id} className="grid gap-1 py-2.5 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                  <span className="text-xs tabular-nums text-muted-foreground">{formatMedium(row.visitDate ?? row.createdAt)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.household.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.by}{row.visited ? ` · ${row.visited}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] ring-1", row.status === "deferred" ? "bg-amber-500/10 text-amber-900 ring-amber-500/30 dark:text-amber-100" : "bg-primary/10 text-primary ring-primary/25")}>{row.status === "deferred" ? "Deferred" : "Visited"}</span>
                    {reaction ? <span className={cn("rounded-full px-2 py-0.5 text-[11px]", reaction.className)}>{reaction.label}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length > shown ? <button type="button" className="mt-2 min-h-10 text-sm text-primary" onClick={() => setShown(shown + PAGE)}>Show more</button> : null}
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{viewer.role === "bochur" ? "Visits you record will show up here." : "Visits your bochurim record will show up here."}</p>
      )}
    </section>
  );
}
