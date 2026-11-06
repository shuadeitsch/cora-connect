"use client";

import Link from "next/link";
import { useMemo } from "react";
import { VISIT_REACTIONS } from "@/lib/constants";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

const TZ = "America/New_York";

/** Today's calendar date in America/New_York, e.g. 2026-11-05. */
function todayEt(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Instant → HH:MM AM/PM in America/New_York. */
function timeEt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(date);
}

function dayEt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * Dashboard "Recent visits": every visit logged today (America/New_York), newest first.
 * Admins see everyone's. A shliach sees his own and his bochurim's. A bochur sees his own.
 * Contacts are already limited to what this person may see.
 */
export function VisitsLog({ data }: { data: AppData }) {
  const { viewer } = data;
  const rows = useMemo(() => {
    const today = todayEt();
    const names = new Map(data.members.map((member) => [member.id, member.name]));
    names.set(viewer.id, viewer.name);
    const who = viewer.role === "admin"
      ? null
      : viewer.role === "bochur"
        ? new Set([viewer.id])
        : new Set([viewer.id, ...data.members.filter((member) => member.leaderId === viewer.id).map((member) => member.id)]);
    return data.households
      .flatMap((household) => household.contactVisits
        .filter((visit) => dayEt(visit.createdAt) === today && (!who || (visit.createdBy && who.has(visit.createdBy))))
        .map((visit) => ({ ...visit, household, by: visit.createdBy ? names.get(visit.createdBy) ?? "Someone" : "Import" })))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.households, data.members, viewer]);

  return (
    <section className="panel rounded-3xl p-4" aria-label="Recent visits">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">Recent visits</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{rows.length ? `${rows.length} today` : "Today"}</span>
          <Link href="/reports" className="text-sm text-primary">View all</Link>
        </div>
      </div>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => {
            const reaction = VISIT_REACTIONS.find((item) => item.id === row.reaction);
            return (
              <li key={row.id} className="grid gap-1 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">{timeEt(row.createdAt)}</span>
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
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No visits yet today</p>
      )}
    </section>
  );
}
