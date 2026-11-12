"use client";

import { holidayLabels } from "@/lib/holidays";
import { RouteCities } from "@/components/route-cities";
import { useToast } from "@/components/toast";

import Link from "next/link";
import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Clock, MapPin, Pencil, Plus, Route as RouteIcon, Trash2, X } from "lucide-react";
import { AddressLink } from "@/components/address-link";
import { googleParts } from "@/lib/google-links";
import { Notice, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addPlannerDayAction, addPlannerItemAction, removePlannerDayAction, removePlannerItemAction, setBochurimEditPlannerAction, setBochurimSeePlannerAction, setPlannerDayChavrusaAction, setPlannerDayEditableAction, setPlannerDayVisibleAction, updatePlannerItemAction } from "@/lib/planner-actions";
import { markPreplannerScheduledAction } from "@/lib/actions";
import { normalizeRequestedTime, preplannerWhen, reachedHowLabel } from "@/lib/preplanner";
import { chavrusaLabel, newDayChavrusa, showChavrusosUi, type Chavrusa, type PlannerChavrusaFilter } from "@/lib/chavrusa";
import type { PlannerDay, PlannerItem } from "@/lib/planner";
import type { AppData } from "@/lib/types";
import { usePractice } from "@/components/practice-provider";

type Planned = { dayId: string; itemId: string; date: string };
const PlannedContext = createContext<Map<string, Planned[]>>(new Map());

function plannedLabel(date: string) {
  return noon(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Other days this route is already planned on (ignoring this day and the item being edited). */
function usePlannedElsewhere(dayId: string, itemId?: string) {
  const planned = useContext(PlannedContext);
  return (routeId: string) => (planned.get(routeId) ?? []).filter((entry) => entry.dayId !== dayId && entry.itemId !== itemId);
}

function noon(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

/** Jewish holiday chips for a day (diaspora, Chabad wording). */
function HolidayChips({ date }: { date: string }) {
  const labels = holidayLabels(date);
  if (!labels.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {labels.map((label) => (
        <span key={label} className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:text-sky-200">{label}</span>
      ))}
    </div>
  );
}

export function gregorianLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(noon(date));
}

/** e.g. "25 Kislev 5787" (the daytime Hebrew date). */
export function hebrewLabel(date: string) {
  return new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(noon(date));
}

/** yyyy-mm-dd plus or minus whole days. */
export function shiftDate(date: string, by: number) {
  const next = noon(date);
  next.setUTCDate(next.getUTCDate() + by);
  return next.toISOString().slice(0, 10);
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shortLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(noon(date));
}

function timeLabel(time: string | null) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export function PlannerView({ data, days, loadError }: { data: AppData; days: PlannerDay[]; loadError: string }) {
  const router = useRouter();
  const practice = usePractice();
  const live = practice.mergeData(data);
  const toast = useToast();
  // Admin + shliach always edit. Bochur edits only when his shliach's toggle is on (RLS enforces too).
  const canEdit =
    live.viewer.role === "admin" ||
    live.viewer.role === "shliach" ||
    (live.viewer.role === "bochur" && Boolean(live.viewer.bochurimEditPlanner));
  const manageVisibility = live.viewer.role === "shliach";
  const bochur = live.viewer.role === "bochur";
  const preview = Boolean(live.viewer.preview);
  // Live bochurim are RLS-scoped; Beta preview still loads all days as admin — filter here.
  // Practice patches day visibility/edit, then bochur view hides invisible days.
  const myBochurim = live.members.filter((member) => member.kind === "member" && member.role === "bochur" && (live.viewer.role === "admin" || member.leaderId === live.viewer.id));
  const showChavrusaSwitch = (live.viewer.role === "shliach" || live.viewer.role === "admin") && showChavrusosUi(myBochurim.length, practice.active, myBochurim.some((member) => Boolean(member.chavrusa)));
  const [plannerFilter, setPlannerFilterState] = useState<PlannerChavrusaFilter>(practice.patch.plannerFilter ?? "all");
  const plannerFilterLive = practice.patch.plannerFilter ?? plannerFilter;
  function setFilter(next: PlannerChavrusaFilter) {
    setPlannerFilterState(next);
    if (practice.active) practice.setPlannerFilter(next);
  }
  const visibleDays = useMemo(
    () => practice.mergeDays(days, bochur, plannerFilterLive),
    [bochur, days, practice, plannerFilterLive],
  );
  const [seePlanner, setSeePlanner] = useState(live.viewer.bochurimSeePlannerDefault !== false);
  const [editPlanner, setEditPlanner] = useState(Boolean(live.viewer.bochurimEditPlanner));
  const [newDate, setNewDate] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const planned = useMemo(() => {
    const map = new Map<string, Planned[]>();
    for (const day of [...visibleDays].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const item of day.items) {
        if (!item.routeId) continue;
        map.set(item.routeId, [...(map.get(item.routeId) ?? []), { dayId: day.id, itemId: item.id, date: day.date }]);
      }
    }
    return map;
  }, [visibleDays]);
  const dates = visibleDays.map((day) => day.date).sort();
  const before = dates.length ? shiftDate(dates[0]!, -1) : "";
  const after = dates.length ? shiftDate(dates[dates.length - 1]!, 1) : "";
  const quick = (date: string, label: string) => (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 w-full justify-center rounded-full"
      disabled={pending}
      onClick={() => { const tag = newDayChavrusa(plannerFilterLive); if (practice.active) { practice.addPlannerDay(date, tag); toast({ title: "Saved in practice mode" }); return; } run(() => addPlannerDayAction(date, tag)); }}
    >
      <CalendarPlus className="size-4" /> {label} · {shortLabel(date)} · {hebrewLabel(date)}
    </Button>
  );

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError("");
    start(async () => {
      const result = await task();
      if (!result.ok) { setError(result.error); toast({ title: result.error, tone: "error" }); }
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <PlannedContext.Provider value={planned}>
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <PageHeader
        title={bochur ? "Daily schedule" : "Daily planner"}
        crumb={bochur ? "Daily schedule" : "Daily planner"}
      />
      {bochur && !canEdit ? (
        <p className="mb-3 rounded-2xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">View only — ask your shliach if you need to edit the schedule.</p>
      ) : null}
      {loadError ? <div className="mb-3"><Notice>{loadError}</Notice></div> : null}
      {error ? <div className="mb-3"><Notice>{error}</Notice></div> : null}
      {manageVisibility ? (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-border bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={seePlanner}
              disabled={pending}
              onChange={(event) => {
                const next = event.target.checked;
                setSeePlanner(next);
                if (practice.active) {
                  practice.setPref("bochurimSeePlannerDefault", next);
                  toast({ title: "Saved in practice mode" });
                  return;
                }
                run(() => setBochurimSeePlannerAction(next));
              }}
            />
            <span>Bochurim can see the planner</span>
          </label>
          {manageVisibility ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={editPlanner}
                disabled={pending}
                onChange={(event) => {
                  const next = event.target.checked;
                  setEditPlanner(next);
                  if (practice.active) {
                    practice.setPref("bochurimEditPlanner", next);
                    toast({ title: "Saved in practice mode" });
                    return;
                  }
                  run(() => setBochurimEditPlannerAction(next));
                }}
              />
              <span>Bochurim can edit the planner</span>
            </label>
          ) : null}
        </div>
      ) : null}
      {showChavrusaSwitch ? (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Planner chavrusa">
          <span className="text-sm text-muted-foreground">Planning for</span>
          {([
            ["all", "All"],
            ["shared", "Shared"],
            ["A", "Chavrusa A"],
            ["B", "Chavrusa B"],
          ] as [PlannerChavrusaFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`min-h-11 rounded-full px-3 text-sm ring-1 ${plannerFilterLive === value ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-foreground ring-border"}`}
              aria-pressed={plannerFilterLive === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {bochur && practice.active ? (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="View as chavrusa">
          <span className="text-sm text-muted-foreground">Viewing as</span>
          {(["A", "B"] as Chavrusa[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`min-h-11 rounded-full px-3 text-sm ring-1 ${(live.viewer.chavrusa ?? "A") === value ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-foreground ring-border"}`}
              aria-pressed={(live.viewer.chavrusa ?? "A") === value}
              onClick={() => practice.setViewerChavrusa(value)}
            >
              Chavrusa {value}
            </button>
          ))}
        </div>
      ) : null}
      {canEdit ? (
        <form
          className="mb-4 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (newDate) { const tag = newDayChavrusa(plannerFilterLive); if (practice.active) { practice.addPlannerDay(newDate, tag); toast({ title: "Saved in practice mode" }); setNewDate(""); return; } run(() => addPlannerDayAction(newDate, tag), () => setNewDate("")); }
          }}
        >
          <Input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} aria-label="Day to add" className="w-auto" />
          <Button type="submit" className="rounded-full" disabled={!newDate || pending}><CalendarPlus className="size-4" /> Add day</Button>
        </form>
      ) : null}
      <div className="grid gap-3">
        {canEdit && !loadError ? (dates.length ? quick(before, "Add day before") : quick(todayIso(), "Add day")) : null}
        {visibleDays.map((day) => {
          const dayCanEdit =
            live.viewer.role === "admin" ||
            live.viewer.role === "shliach" ||
            (live.viewer.role === "bochur" && day.editableByBochurim);
          return (
            <DayCard key={day.id} data={live} day={day} canEdit={dayCanEdit} manageVisibility={manageVisibility} manageChavrusa={showChavrusaSwitch} pending={pending} run={run} />
          );
        })}
        {canEdit && !loadError && dates.length ? quick(after, "Add day after") : null}
        {!visibleDays.length && !loadError ? <p className="panel rounded-3xl px-4 py-10 text-center text-sm text-muted-foreground">No days in the planner.</p> : null}
      </div>
    </div>
    </PlannedContext.Provider>
  );
}


function RequestedVisitsStrip({
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
  const practice = usePractice();
  const toast = useToast();
  const entries = (data.preplannerEntries ?? [])
    .filter((entry) => entry.requestedDate === day.date && !entry.scheduledAt)
    .slice()
    .sort((a, b) => (a.requestedTime || "").localeCompare(b.requestedTime || "") || a.createdAt.localeCompare(b.createdAt));
  if (!entries.length) return null;
  const byId = new Map(data.households.map((household) => [household.id, household]));

  return (
    <div className="mt-3 rounded-2xl border border-amber-400/50 bg-amber-500/15 p-3">
      <p className="text-sm font-semibold text-foreground">Requested visits</p>
      <ul className="mt-2 grid gap-2">
        {entries.map((entry) => {
          const household = byId.get(entry.householdId);
          const time = normalizeRequestedTime(entry.requestedTime) ?? entry.requestedTime.slice(0, 5);
          const title = household?.name ? `Visit: ${household.name}` : "Requested visit";
          const notes = [reachedHowLabel(entry.reachedHow) ? `Reached out by ${reachedHowLabel(entry.reachedHow)}` : "", entry.notes].filter(Boolean).join("\n\n");
          return (
            <li key={entry.id} className="flex flex-col gap-2 rounded-xl bg-background/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{household?.name ?? "Contact no longer on your list"}</p>
                <p className="text-sm text-muted-foreground">{preplannerWhen(entry.requestedDate, entry.requestedTime)} · {reachedHowLabel(entry.reachedHow)}</p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  className="min-h-11 shrink-0 rounded-full"
                  disabled={pending}
                  onClick={() => {
                    if (practice.active) {
                      practice.addPlannerItem({ dayId: day.id, kind: "event", title, time, notes, address: household?.address ?? "" });
                      toast({ title: "Added in practice mode" });
                      return;
                    }
                    run(async () => {
                      const added = await addPlannerItemAction({
                        dayId: day.id,
                        kind: "event",
                        title,
                        time,
                        notes,
                        address: household?.address ?? "",
                      });
                      if (!added.ok) return added;
                      return markPreplannerScheduledAction(entry.id, day.id);
                    });
                  }}
                >
                  Add to this day
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DayCard({
  data,
  day,
  canEdit,
  manageVisibility,
  manageChavrusa,
  pending,
  run,
}: {
  data: AppData;
  day: PlannerDay;
  canEdit: boolean;
  manageVisibility: boolean;
  manageChavrusa: boolean;
  pending: boolean;
  run: (task: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) => void;
}) {
  const [adding, setAdding] = useState<"" | "route" | "event">("");
  const practice = usePractice();
  const toast = useToast();
  const preview = Boolean(data.viewer.preview);

  return (
    <section className="panel rounded-3xl p-4">
      {manageVisibility ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={day.visibleToBochurim}
              disabled={pending}
              onChange={(event) => {
                const next = event.target.checked;
                if (practice.active) {
                  practice.setPlannerVisible(day.id, next);
                  toast({ title: next ? "Day visible (practice)" : "Day hidden (practice)" });
                  return;
                }
                run(() => setPlannerDayVisibleAction(day.id, next));
              }}
            />
            <span>Bochurim can see this day</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={day.editableByBochurim}
              disabled={pending}
              onChange={(event) => {
                const next = event.target.checked;
                if (practice.active) {
                  practice.setPlannerEditable(day.id, next);
                  toast({ title: next ? "Day editable (practice)" : "Day locked (practice)" });
                  return;
                }
                run(() => setPlannerDayEditableAction(day.id, next));
              }}
            />
            <span>Bochurim can edit this day</span>
          </label>
        </div>
      ) : null}
      {manageChavrusa ? (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <span>This day is for</span>
          <select
            className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
            value={day.chavrusa ?? ""}
            disabled={pending}
            aria-label={`Chavrusa for ${gregorianLabel(day.date)}`}
            onChange={(event) => {
              const next = event.target.value === "A" || event.target.value === "B" ? event.target.value : null;
              if (practice.active) {
                practice.setPlannerDayChavrusa(day.id, next);
                toast({ title: `Saved in practice mode · ${chavrusaLabel(next)}` });
                return;
              }
              run(() => setPlannerDayChavrusaAction(day.id, next));
            }}
          >
            <option value="">Shared</option>
            <option value="A">Chavrusa A</option>
            <option value="B">Chavrusa B</option>
          </select>
        </label>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {gregorianLabel(day.date)}
            {day.chavrusa || manageChavrusa ? (
              <span className="ml-2 align-middle rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{chavrusaLabel(day.chavrusa)}</span>
            ) : null}
          </h2>
          <p className="text-sm text-muted-foreground">{hebrewLabel(day.date)}</p>
          <HolidayChips date={day.date} />
        </div>
        {canEdit ? (
          <button
            type="button"
            aria-label={`Remove ${gregorianLabel(day.date)}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-red-600 hover:bg-muted"
            disabled={pending}
            onClick={() => {
              if (!confirm(day.items.length ? `Remove this day and its ${day.items.length} item${day.items.length === 1 ? "" : "s"}?` : "Remove this day?")) return;
              if (practice.active) { practice.removePlannerDay(day.id); toast({ title: "Saved in practice mode" }); return; }
              run(() => removePlannerDayAction(day.id));
            }}
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      <RequestedVisitsStrip data={data} day={day} canEdit={canEdit} pending={pending} run={run} />
      <ul className="mt-3 grid gap-2">
        {day.items.map((item) => <ItemRow key={item.id} data={data} dayId={day.id} item={item} canEdit={canEdit} pending={pending} run={run} />)}
        {!day.items.length ? <li className="text-sm text-muted-foreground">Nothing planned.</li> : null}
      </ul>
      {canEdit && !adding ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setAdding("route")} disabled={!data.routes.length}><RouteIcon className="size-4" /> Add route</Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setAdding("event")}><Plus className="size-4" /> Add event</Button>
        </div>
      ) : null}
      {adding ? (
        <ItemForm
          data={data}
          kind={adding}
          dayId={day.id}
          pending={pending}
          onCancel={() => setAdding("")}
          onSave={(values) => { if (practice.active) { practice.addPlannerItem({ dayId: day.id, kind: adding, ...values }); toast({ title: "Saved in practice mode" }); setAdding(""); return; } run(() => addPlannerItemAction({ dayId: day.id, kind: adding, ...values }), () => setAdding("")); }}
        />
      ) : null}
    </section>
  );
}

type ItemValues = { routeId: string; title: string; time: string; notes: string; address: string };

/** The add form, also used prefilled for Edit. */
function ItemForm({
  data,
  kind,
  item,
  dayId,
  pending,
  onSave,
  onCancel,
}: {
  data: AppData;
  kind: "route" | "event";
  item?: PlannerItem;
  dayId: string;
  pending: boolean;
  onSave: (values: ItemValues) => void;
  onCancel: () => void;
}) {
  const elsewhere = usePlannedElsewhere(dayId, item?.id);
  const [confirmFor, setConfirmFor] = useState("");
  const [routeId, setRouteId] = useState(item?.routeId ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [time, setTime] = useState(item?.time ? item.time.slice(0, 5) : "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [address, setAddress] = useState(item?.address ?? "");
  const editing = Boolean(item);
  return (
    <form
      className="mt-3 grid min-w-0 grid-cols-1 gap-2 rounded-2xl bg-muted/50 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const route = data.routes.find((entry) => entry.id === routeId);
        const changed = kind === "route" && routeId !== (item?.routeId ?? "");
        if (changed && elsewhere(routeId).length && confirmFor !== routeId) { setConfirmFor(`ask:${routeId}`); return; }
        onSave({ routeId, title: kind === "route" ? route?.name ?? title : title, time, notes, address });
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {editing ? (kind === "route" ? "Edit route" : "Edit event") : kind === "route" ? "Add a route" : "Add an event"}
        </p>
        <button type="button" aria-label="Cancel" onClick={onCancel}><X className="size-4" /></button>
      </div>
      {kind === "route" ? (
        <select className="h-10 w-full min-w-0 max-w-full truncate rounded-lg border bg-card px-2 text-sm" value={routeId} onChange={(event) => { setRouteId(event.target.value); setConfirmFor(""); }} aria-label="Route">
          <option value="">Pick a saved route</option>
          {data.routes.map((route) => {
            const on = route.id === item?.routeId ? [] : elsewhere(route.id);
            return <option key={route.id} value={route.id}>{route.name} ({route.stopCount} stops){on.length ? ` · Already planned · ${on.map((entry) => plannedLabel(entry.date)).join(", ")}` : ""}</option>;
          })}
        </select>
      ) : (
        <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" aria-label="Title" />
      )}
      {kind === "event" ? (
        <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address (optional)" aria-label="Address (optional)" autoComplete="street-address" />
      ) : null}
      {kind === "route" && routeId && routeId !== (item?.routeId ?? "") && elsewhere(routeId).length ? (
        <div role="alert" className="grid gap-2 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800">
          <p>This route is already on {elsewhere(routeId).map((entry) => plannedLabel(entry.date)).join(", ")}.</p>
          {confirmFor !== routeId ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-full" disabled={pending} onClick={() => { setConfirmFor(routeId); const route = data.routes.find((entry) => entry.id === routeId); onSave({ routeId, title: route?.name ?? title, time, notes, address }); }}>{editing ? "Save anyway" : "Add anyway"}</Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => { setRouteId(item?.routeId ?? ""); setConfirmFor(""); }}>Cancel</Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} aria-label="Time (optional)" className="w-auto" />
      <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes (optional)" aria-label="Notes" rows={2} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="rounded-full" disabled={pending || (kind === "route" ? !routeId || (routeId !== (item?.routeId ?? "") && elsewhere(routeId).length > 0 && confirmFor !== routeId) : !title.trim())}>
          {pending ? "Saving…" : editing ? "Save" : "Add"}
        </Button>
        {editing ? <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </form>
  );
}

function ItemRow({
  data,
  dayId,
  item,
  canEdit,
  pending,
  run,
}: {
  data: AppData;
  dayId: string;
  item: PlannerItem;
  canEdit: boolean;
  pending: boolean;
  run: (task: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const practice = usePractice();
  const toast = useToast();
  const route = item.routeId ? data.routes.find((entry) => entry.id === item.routeId) : undefined;
  if (editing) {
    return (
      <li>
        <ItemForm
          data={data}
          kind={item.kind}
          item={item}
          dayId={dayId}
          pending={pending}
          onCancel={() => setEditing(false)}
          onSave={(values) => {
            if (practice.active) {
              practice.updatePlannerItem({ id: item.id, ...values });
              toast({ title: "Saved in practice mode" });
              setEditing(false);
              return;
            }
            run(() => updatePlannerItemAction({ id: item.id, kind: item.kind, ...values }), () => setEditing(false));
          }}
        />
      </li>
    );
  }
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
        {route ? <RouteCities stops={route.stops} /> : null}
        {route ? <RouteStartLinks route={route} /> : null}
        {item.kind === "event" && item.address ? (
          <p className="mt-0.5 flex items-center gap-1 text-sm">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
            <AddressLink address={item.address} className="text-link" />
          </p>
        ) : null}
        {item.notes ? <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{item.notes}</p> : null}
      </div>
      {canEdit ? (
        <button
          type="button"
          aria-label="Edit"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-4" />
        </button>
      ) : null}
      {canEdit ? (
        <button
          type="button"
          aria-label="Remove"
          className="inline-flex size-8 items-center justify-center rounded-full text-red-600 hover:bg-muted"
          disabled={pending}
          onClick={() => { if (practice.active) { practice.removePlannerItem(item.id); toast({ title: "Saved in practice mode" }); return; } run(() => removePlannerItemAction(item.id)); }}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </li>
  );
}


function place(stop: { name?: string; address?: string; street?: string; city?: string; state?: string; zip?: string; lat?: number | null; lng?: number | null }) {
  if (stop.lat != null && stop.lng != null) return `${stop.lat},${stop.lng}`;
  return [stop.address || stop.street, stop.city, stop.state, stop.zip, stop.name].filter(Boolean).join(", ");
}

function RouteStartLinks({ route }: { route: AppData["routes"][number] }) {
  const stops = route.stops ?? [];
  if (!stops.length) return null;
  const first = stops[0]!;
  const stopAddrs = stops.map((s) => place(s));
  const { parts } = googleParts("", stopAddrs);
  const google = parts[0]?.url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place(first))}`;
  const apple = `https://maps.apple.com/?daddr=${encodeURIComponent(place(first))}&dirflg=d`;
  return (
    <p className="mt-1.5 flex flex-wrap gap-2 text-xs">
      <a href={google} target="_blank" rel="noreferrer" className="rounded-full bg-accent px-2.5 py-1 font-medium text-foreground hover:underline">Google Maps</a>
      <a href={apple} target="_blank" rel="noreferrer" className="rounded-full bg-accent px-2.5 py-1 font-medium text-foreground hover:underline">Apple Maps</a>
    </p>
  );
}
