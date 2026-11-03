"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Clock, Plus, Route as RouteIcon, Trash2, X } from "lucide-react";
import { Notice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addPlannerDayAction, addPlannerItemAction, removePlannerDayAction, removePlannerItemAction } from "@/lib/planner-actions";
import type { PlannerDay, PlannerItem } from "@/lib/planner";
import type { AppData } from "@/lib/types";

function noon(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

export function gregorianLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(noon(date));
}

/** e.g. "25 Kislev 5787" (the daytime Hebrew date). */
export function hebrewLabel(date: string) {
  return new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(noon(date));
}

function timeLabel(time: string | null) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export function PlannerView({ data, days, loadError }: { data: AppData; days: PlannerDay[]; loadError: string }) {
  const router = useRouter();
  const canEdit = data.viewer.canManage;
  const [newDate, setNewDate] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError("");
    start(async () => {
      const result = await task();
      if (!result.ok) setError(result.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <PageHeader title="Daily planner" crumb="Daily planner" />
      {loadError ? <div className="mb-3"><Notice>{loadError}</Notice></div> : null}
      {error ? <div className="mb-3"><Notice>{error}</Notice></div> : null}
      {canEdit ? (
        <form
          className="mb-4 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (newDate) run(() => addPlannerDayAction(newDate), () => setNewDate(""));
          }}
        >
          <Input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} aria-label="Day to add" className="w-auto" />
          <Button type="submit" className="rounded-full" disabled={!newDate || pending}><CalendarPlus className="size-4" /> Add day</Button>
        </form>
      ) : null}
      <div className="grid gap-3">
        {days.map((day) => (
          <DayCard key={day.id} data={data} day={day} canEdit={canEdit} pending={pending} run={run} />
        ))}
        {!days.length && !loadError ? <p className="panel rounded-3xl px-4 py-10 text-center text-sm text-muted-foreground">No days in the planner.</p> : null}
      </div>
    </div>
  );
}

function DayCard({
  data,
  day,
  canEdit,
  pending,
  run,
}: {
  data: AppData;
  day: PlannerDay;
  canEdit: boolean;
  pending: boolean;
  run: (task: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) => void;
}) {
  const [adding, setAdding] = useState<"" | "route" | "event">("");
  const [routeId, setRouteId] = useState("");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const reset = () => { setAdding(""); setRouteId(""); setTitle(""); setTime(""); setNotes(""); };

  return (
    <section className="panel rounded-3xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{gregorianLabel(day.date)}</h2>
          <p className="text-sm text-muted-foreground">{hebrewLabel(day.date)}</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            aria-label={`Remove ${gregorianLabel(day.date)}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-red-600 hover:bg-muted"
            disabled={pending}
            onClick={() => {
              if (!confirm(day.items.length ? `Remove this day and its ${day.items.length} item${day.items.length === 1 ? "" : "s"}?` : "Remove this day?")) return;
              run(() => removePlannerDayAction(day.id));
            }}
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      <ul className="mt-3 grid gap-2">
        {day.items.map((item) => <ItemRow key={item.id} data={data} item={item} canEdit={canEdit} pending={pending} run={run} />)}
        {!day.items.length ? <li className="text-sm text-muted-foreground">Nothing planned.</li> : null}
      </ul>
      {canEdit && !adding ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setAdding("route")} disabled={!data.routes.length}><RouteIcon className="size-4" /> Add route</Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setAdding("event")}><Plus className="size-4" /> Add event</Button>
        </div>
      ) : null}
      {adding ? (
        <form
          className="mt-3 grid gap-2 rounded-2xl bg-muted/50 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const route = data.routes.find((item) => item.id === routeId);
            run(
              () => addPlannerItemAction({ dayId: day.id, kind: adding, routeId, title: adding === "route" ? route?.name ?? "" : title, time, notes }),
              reset,
            );
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{adding === "route" ? "Add a route" : "Add an event"}</p>
            <button type="button" aria-label="Cancel" onClick={reset}><X className="size-4" /></button>
          </div>
          {adding === "route" ? (
            <select className="h-10 rounded-lg border bg-card px-2 text-sm" value={routeId} onChange={(event) => setRouteId(event.target.value)} aria-label="Route">
              <option value="">Pick a saved route</option>
              {data.routes.map((route) => <option key={route.id} value={route.id}>{route.name} ({route.stopCount} stops)</option>)}
            </select>
          ) : (
            <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" aria-label="Title" />
          )}
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} aria-label="Time (optional)" className="w-auto" />
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes (optional)" aria-label="Notes" rows={2} />
          <Button type="submit" className="justify-self-start rounded-full" disabled={pending || (adding === "route" ? !routeId : !title.trim())}>
            {pending ? "Saving…" : "Add"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function ItemRow({
  data,
  item,
  canEdit,
  pending,
  run,
}: {
  data: AppData;
  item: PlannerItem;
  canEdit: boolean;
  pending: boolean;
  run: (task: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const route = item.routeId ? data.routes.find((entry) => entry.id === item.routeId) : undefined;
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/8">
      <span className="mt-0.5 text-primary">{item.kind === "route" ? <RouteIcon className="size-4" /> : <Clock className="size-4" />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {item.time ? <span className="mr-2 text-muted-foreground">{timeLabel(item.time)}</span> : null}
          {route ? <Link href={`/saved-routes/${route.id}`} className="hover:text-link hover:underline">{route.name}</Link> : item.title || "Route"}
          {item.kind === "route" && !route ? <span className="ml-2 text-xs font-normal text-muted-foreground">(route removed)</span> : null}
        </p>
        {route ? <p className="text-xs text-muted-foreground">{route.stopCount} stops</p> : null}
        {item.notes ? <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{item.notes}</p> : null}
      </div>
      {canEdit ? (
        <button
          type="button"
          aria-label="Remove"
          className="inline-flex size-8 items-center justify-center rounded-full text-red-600 hover:bg-muted"
          disabled={pending}
          onClick={() => run(() => removePlannerItemAction(item.id))}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </li>
  );
}
