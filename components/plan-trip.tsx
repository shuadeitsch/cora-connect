"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Navigation, Plus, Route as RouteIcon, Save, Trash2, X } from "lucide-react";
import { PageHeader, Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cityKey, ContactStateTabs, useContactFilters } from "@/components/contact-filters";
import { useMapPoints } from "@/components/map-points";
import type { MapPin } from "@/components/map-canvas";
import { OverlapBadge, RouteProjectSelect } from "@/components/route-project";
import { useToast } from "@/components/toast";
import { geocodeStartAction, saveRouteAction } from "@/lib/actions";
import { driveMatrixAction } from "@/lib/osrm-actions";
import { addTripDayToPlannerAction } from "@/lib/planner-actions";
import { googleParts } from "@/lib/google-links";
import { miles } from "@/lib/geo";
import { overlapBadge, useOverlap, useRouteProject } from "@/lib/route-overlap";
import { clock, orderDay, parseClock, scheduleDay, splitByAngle, sunsetMinutes, type DayTimes, type Matrix, type Pt, type TripStop } from "@/lib/trip";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(() => import("@/components/map-canvas").then((mod) => mod.MapCanvas), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> });

const START_KEY = "cora.trip.start";
type Start = Pt & { label: string };
type Extra = { id: string; name: string; address: string; time: string; day: number; point: Pt | null };
type DayPlan = { date: string; stops: TripStop[]; matrix: Matrix; times: DayTimes; sunset: number | null; timed: boolean; routeId?: string; plannerItems?: string[] };
const MAX_DAYS = 14;
const PLAN_KEY = "cora.trip.plan";
/** Server actions can fail outright (network, or the app was updated while this page was open). */
function failMessage(error: unknown) {
  const text = error instanceof Error ? error.message : "";
  if (/server action|failed to find|unexpected response|fetch/i.test(text)) return "Cora Connect was just updated or the connection dropped. Your plan is kept: reload the page and press Save again.";
  return text ? `Something went wrong: ${text}` : "Something went wrong. Try again.";
}

function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
function isoPlus(days: number) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
const toTime = (minutes: number) => `${String(Math.floor((((minutes % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String(Math.round(minutes) % 60).padStart(2, "0")}`;

export function PlanTrip({ data, plannerDates }: { data: AppData; plannerDates: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const ctl = useContactFilters(data, "");
  const { pointFor } = useMapPoints(data.households);
  const project = useRouteProject(data);
  const overlap = useOverlap(data, project.projectId);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const org = data.org;
  const orgStart: Start | null = org.startLat != null && org.startLng != null
    ? { lat: org.startLat, lng: org.startLng, label: [org.street, org.city, org.state].filter(Boolean).join(", ") || org.chabadHouseName || "Start" }
    : null;
  const [startPlace, setStartPlace] = useState<Start | null>(orgStart);
  // Last used start (this device), loaded after hydration.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(START_KEY) ?? "null") as Start | null;
      if (saved && typeof saved.lat === "number") setStartPlace(saved);
    } catch {}
  }, []);
  const [startText, setStartText] = useState("");
  const [back, setBack] = useState(true);

  const [picked, setPicked] = useState<string[]>([]);
  const [nearby, setNearby] = useState(5);
  const future = plannerDates.filter((date) => date >= isoPlus(0)).sort();
  const [dayCount, setDayCount] = useState(2);
  const [dates, setDates] = useState<string[]>(() => Array.from({ length: MAX_DAYS }, (_, i) => future[i] ?? isoPlus(i + 1)));
  const [startTimes, setStartTimes] = useState<string[]>(() => Array(MAX_DAYS).fill(""));
  const [finishTimes, setFinishTimes] = useState<string[]>(() => Array(MAX_DAYS).fill(""));
  const [visitText, setVisitText] = useState("15");
  const visit = Math.max(0, Math.min(240, Number(visitText) || 0));
  const [useTimes, setUseTimes] = useState(true);
  const [dayText, setDayText] = useState("2");
  const [extras, setExtras] = useState<Extra[]>([]);
  const [skipTaken, setSkipTaken] = useState(true);
  const [plan, setPlan] = useState<DayPlan[] | null>(null);
  const [names, setNames] = useState<string[]>([]);
  // Keep the last plan on this device so a reload (or an app update) doesn't lose it before it's saved.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(PLAN_KEY) ?? "null") as { plan: DayPlan[]; names: string[] } | null;
      if (saved?.plan?.length) { setPlan(saved.plan.map((day) => ({ ...day, timed: day.timed ?? true }))); setNames(saved.names ?? []); }
    } catch {}
  }, []);
  useEffect(() => {
    try { if (plan) window.sessionStorage.setItem(PLAN_KEY, JSON.stringify({ plan, names })); } catch {}
  }, [plan, names]);

  // Cities with contacts this user can see (hidden tags already excluded), sorted by distance from the start.
  const cityRows = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; ids: string[]; lat: number; lng: number; n: number }>();
    for (const household of ctl.beforeCity) {
      const key = cityKey(household.city);
      if (!key) continue;
      const point = pointFor(household);
      const row = groups.get(key) ?? { key, label: household.city.trim(), ids: [], lat: 0, lng: 0, n: 0 };
      row.ids.push(household.id);
      if (point) { row.lat += point.lat; row.lng += point.lng; row.n += 1; }
      groups.set(key, row);
    }
    return [...groups.values()].map((row) => {
      const center = row.n ? { lat: row.lat / row.n, lng: row.lng / row.n } : null;
      return { key: row.key, label: row.label, count: row.ids.length, center, away: center && startPlace ? miles(startPlace, center) : null };
    }).sort((a, b) => (a.away ?? 1e9) - (b.away ?? 1e9) || a.label.localeCompare(b.label));
  }, [ctl.beforeCity, pointFor, startPlace]);

  const located = useMemo(() => ctl.beforeCity.flatMap((household) => {
    const point = pointFor(household);
    return point ? [{ household, point }] : [];
  }), [ctl.beforeCity, pointFor]);

  const chosen = useMemo(() => {
    const keys = new Set(picked);
    const inCities = located.filter((entry) => keys.has(cityKey(entry.household.city)));
    const extra = nearby > 0 ? located.filter((entry) => !keys.has(cityKey(entry.household.city)) && inCities.some((other) => miles(other.point, entry.point) <= nearby)) : [];
    return { inCities, extra };
  }, [picked, located, nearby]);
  const all = [...chosen.inCities, ...chosen.extra];
  const takenCount = all.filter((entry) => overlap.has(entry.household.id)).length;
  const unplacedCount = ctl.beforeCity.filter((household) => picked.includes(cityKey(household.city)) && !pointFor(household)).length;

  async function timesFor(stops: TripStop[], dayIndex: number, from: Start) {
    const matrix = await driveMatrixAction([from, ...stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))]);
    const startAt = useTimes ? parseClock(startTimes[dayIndex] ?? "") : null;
    const finishBy = useTimes ? parseClock(finishTimes[dayIndex] ?? "") : null;
    const plain = stops.map((stop) => (useTimes ? stop : { ...stop, fixed: undefined }));
    const times = scheduleDay(plain, matrix, { visit, back, startAt, finishBy });
    // Clock times only make sense with a visit length and at least one time to fit around.
    const timed = useTimes && visit > 0 && (startAt != null || finishBy != null || plain.some((stop) => stop.fixed != null));
    return { matrix, times, timed };
  }

  async function buildDay(stops: TripStop[], dayIndex: number, from: Start): Promise<DayPlan> {
    const ordered = orderDay(from, useTimes ? stops : stops.map((stop) => ({ ...stop, fixed: undefined })), back);
    const { matrix, times, timed } = await timesFor(ordered, dayIndex, from);
    return { date: dates[dayIndex]!, stops: ordered, matrix, times, timed, sunset: sunsetMinutes(dates[dayIndex]!, from) };
  }

  function suggestName(stops: TripStop[], date: string, index: number) {
    const cities = [...new Set(stops.filter((s) => s.kind === "contact").map((s) => s.address.split(",").at(-2)?.trim() || ""))].filter(Boolean);
    const where = `${cities.slice(0, 3).join(", ")}${cities.length > 3 ? " +" + (cities.length - 3) : ""}`;
    return [project.projectName, `Day ${index + 1}`, where || dayLabel(date)].filter(Boolean).join(" · ");
  }

  function build() {
    setError("");
    start(async () => { try {
      if (!startPlace) { setError("Set a start place first."); return; }
      const contacts: TripStop[] = all
        .filter((entry) => !(skipTaken && overlap.has(entry.household.id)))
        .map(({ household, point }) => ({ id: household.id, kind: "contact", name: household.name, address: household.address, lat: point.lat, lng: point.lng }));
      if (!contacts.length && all.length && skipTaken) { setError(`All ${all.length} contacts here are already on another ${project.projectName || "project"} route. Pick "Include anyway" or other cities.`); return; }
      if (!contacts.length && !extras.length) { setError("Pick at least one city."); return; }
      const placed: TripStop[] = [];
      for (const extra of extras) {
        if (!extra.name.trim() && !extra.address.trim()) continue;
        let point = extra.point;
        if (!point) {
          const found = await geocodeStartAction(extra.address || extra.name);
          if (!found.ok) { setError(`Couldn't find “${extra.name || extra.address}”. Add the town and state.`); return; }
          point = { lat: found.data.lat, lng: found.data.lng };
          setExtras((list) => list.map((item) => (item.id === extra.id ? { ...item, point } : item)));
        }
        placed.push({ id: extra.id, kind: "extra", name: extra.name || extra.address, address: extra.address || extra.name, lat: point.lat, lng: point.lng, fixed: parseClock(extra.time) ?? undefined, day: Math.min(extra.day, dayCount - 1) });
      }
      const groups = splitByAngle(startPlace, contacts, dayCount);
      for (const extra of placed) groups[extra.day ?? 0]!.push(extra);
      const days = await Promise.all(groups.map((stops, index) => buildDay(stops, index, startPlace)));
      setPlan(days);
      setNames(days.map((day, index) => suggestName(day.stops, day.date, index)));
      window.localStorage.setItem(START_KEY, JSON.stringify(startPlace));
    } catch (err) { setError(failMessage(err)); } });
  }

  function tweak(dayIndex: number, stopId: string, to: number | "remove") {
    if (!plan || !startPlace) return;
    start(async () => {
      const stop = plan[dayIndex]!.stops.find((s) => s.id === stopId)!;
      const next = plan.map((day) => day.stops.filter((s) => s.id !== stopId));
      if (to !== "remove") next[to]!.push({ ...stop, day: to });
      const touched = new Set([dayIndex, ...(to === "remove" ? [] : [to])]);
      const days = await Promise.all(plan.map((day, index) => (touched.has(index) ? buildDay(next[index]!, index, startPlace).then((built) => ({ ...built, routeId: undefined, plannerItems: undefined })) : Promise.resolve(day))));
      setPlan(days);
    });
  }

  async function saveOne(index: number) {
    const day = plan![index]!;
    const ids = day.stops.filter((s) => s.kind === "contact").map((s) => s.id);
    const name = (names[index] ?? "").trim() || suggestName(day.stops, day.date, index);
    let result: Awaited<ReturnType<typeof saveRouteAction>>;
    try {
      result = await saveRouteAction({ name, projectId: project.projectId, optimized: true, householdIds: ids });
    } catch (err) {
      return { ok: false as const, error: failMessage(err) };
    }
    if (!result.ok) return { ok: false as const, error: result.error };
    const id = (result.data as { id?: string } | undefined)?.id;
    if (!id) return { ok: false as const, error: "The route wasn't saved. Try again." };
    setPlan((list) => list!.map((d, i) => (i === index ? { ...d, routeId: id } : d)));
    return { ok: true as const, id, name };
  }

  function saveDay(index: number) {
    start(async () => {
      const result = await saveOne(index);
      if (!result.ok) { toast({ title: result.error, tone: "error" }); setError(result.error); return; }
      setError("");
      toast({ title: `Route saved: ${result.name}`, action: { label: "View", href: `/saved-routes/${result.id}` } });
    });
  }

  function saveAll() {
    start(async () => {
      let saved = 0;
      for (let index = 0; index < plan!.length; index += 1) {
        const day = plan![index]!;
        if (day.routeId || !day.stops.some((s) => s.kind === "contact")) continue;
        const result = await saveOne(index);
        if (!result.ok) { toast({ title: result.error, tone: "error" }); setError(result.error); return; }
        saved += 1;
      }
      setError("");
      toast({ title: saved ? `${saved} ${saved === 1 ? "route" : "routes"} saved` : "Everything is already saved", action: { label: "Routes", href: "/saved-routes" } });
    });
  }

  function planDay(index: number) {
    const day = plan![index]!;
    if (!day.routeId) return;
    start(async () => { try {
      const events = day.stops.flatMap((stop, i) => (stop.kind === "extra" ? [{ title: stop.name, time: toTime(day.times.arrivals[i]!), address: stop.address }] : []));
      const result = await addTripDayToPlannerAction({ date: day.date, routeId: day.routeId!, title: names[index] || "Route", time: day.timed ? toTime(day.times.leave) : "", events: day.timed ? events : events.map((event) => ({ ...event, time: undefined })) });
      if (!result.ok) { toast({ title: result.error, tone: "error" }); return; }
      setPlan((list) => list!.map((d, i) => (i === index ? { ...d, plannerItems: result.itemIds } : d)));
      toast({ title: `Added to the planner · ${dayLabel(day.date)}`, action: { label: "View", href: "/planner" } });
    } catch (err) { toast({ title: failMessage(err), tone: "error" }); } });
  }

  const field = "grid gap-1 text-sm";
  const label = "text-xs font-medium text-mutedink";

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader title="Plan a trip" crumb="Plan a trip" description="" />
      <p className="-mt-2 mb-4 text-sm text-mutedink">Pick the areas, days and any fixed stops. Cora splits the contacts across the days, orders each day, and suggests when to leave. Nothing is saved until you press Save.</p>
      {error ? <div className="mb-3"><Notice>{error}</Notice></div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel grid gap-3 rounded-3xl p-4">
          <h2 className="font-heading text-lg font-semibold">1. Cities and areas</h2>
          <ContactStateTabs ctl={ctl} />
          <div className="max-h-64 overflow-auto rounded-2xl ring-1 ring-foreground/8">
            {cityRows.map((city) => (
              <label key={city.key} className="flex min-h-11 items-center gap-2 border-b px-3 py-1.5 text-sm last:border-0">
                <input type="checkbox" className="size-4" checked={picked.includes(city.key)} onChange={(event) => setPicked(event.target.checked ? [...picked, city.key] : picked.filter((key) => key !== city.key))} />
                <span className="flex-1 font-medium text-foreground">{city.label}</span>
                <span className="text-xs text-mutedink">{city.count} · {city.away != null ? `${Math.round(city.away)} mi` : "—"}</span>
              </label>
            ))}
          </div>
          <label className={field}>
            <span className={label}>Include nearby stops within {nearby} mi</span>
            <input type="range" min={0} max={20} step={1} value={nearby} onChange={(event) => setNearby(Number(event.target.value))} aria-label="Nearby miles" />
          </label>
          <p className="text-xs text-mutedink">{chosen.inCities.length} contacts in {picked.length} {picked.length === 1 ? "city" : "cities"} + {chosen.extra.length} nearby{unplacedCount ? ` · ${unplacedCount} without a map spot` : ""}</p>
        </section>

        <section className="panel grid gap-3 rounded-3xl p-4">
          <h2 className="font-heading text-lg font-semibold">2. Days and start</h2>
          <label className={field}>
            <span className={label}>Number of days</span>
            <Input type="number" inputMode="numeric" min={1} max={MAX_DAYS} className="w-24" value={dayText} onChange={(event) => { setDayText(event.target.value); const n = Math.round(Number(event.target.value)); if (n >= 1) setDayCount(Math.min(MAX_DAYS, n)); }} onBlur={() => setDayText(String(dayCount))} aria-label="Number of days" />
            <span className="text-xs text-mutedink">1 to {MAX_DAYS} days</span>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={useTimes} onChange={(event) => setUseTimes(event.target.checked)} aria-label="Fit between times" /> Fit between times <span className="text-xs text-mutedink">(optional start / finish times)</span></label>
          {Array.from({ length: dayCount }, (_, i) => (
            <div key={i} className={cn("grid items-end gap-2", useTimes ? "grid-cols-[1fr_auto_auto]" : "grid-cols-1")}>
              <label className={field}><span className={label}>Day {i + 1}</span><Input type="date" value={dates[i]} onChange={(event) => setDates(dates.map((d, j) => (j === i ? event.target.value : d)))} aria-label={`Day ${i + 1} date`} /></label>
              {useTimes ? <><label className={field}><span className={label}>Start at</span><Input type="time" className="w-28" value={startTimes[i]} onChange={(event) => setStartTimes(startTimes.map((t, j) => (j === i ? event.target.value : t)))} aria-label={`Day ${i + 1} start time`} /></label>
              <label className={field}><span className={label}>Finish by</span><Input type="time" className="w-28" value={finishTimes[i]} onChange={(event) => setFinishTimes(finishTimes.map((t, j) => (j === i ? event.target.value : t)))} aria-label={`Day ${i + 1} finish time`} /></label></> : null}
            </div>
          ))}
          <div className={field}>
            <span className={label}>Start place</span>
            <p className="text-sm text-foreground">{startPlace ? startPlace.label : "Not set"}</p>
            <div className="flex gap-2">
              <Input value={startText} onChange={(event) => setStartText(event.target.value)} placeholder="Type a different address or town" aria-label="Start address" />
              <Button type="button" className="rounded-full" disabled={pending || !startText.trim()} onClick={() => start(async () => {
                const found = await geocodeStartAction(startText);
                if (!found.ok) { setError(found.error); return; }
                setStartPlace({ lat: found.data.lat, lng: found.data.lng, label: startText.trim() });
                setStartText("");
              })}>Set</Button>
            </div>
            {orgStart && startPlace?.label !== orgStart.label ? <button type="button" className="justify-self-start text-xs text-link underline" onClick={() => setStartPlace(orgStart)}>Use the Chabad House start</button> : null}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={back} onChange={(event) => setBack(event.target.checked)} /> Return to the start at the end of each day</label>
          </div>
          <label className={field}>
            <span className={label}>Minutes per visit (optional)</span>
            <Input type="number" min={0} max={240} className="w-24" value={visitText} placeholder="—" onChange={(event) => setVisitText(event.target.value)} aria-label="Minutes per visit" />
            {!visit ? <span className="text-xs text-mutedink">Blank: the plan shows drive times only, no arrival times.</span> : null}
          </label>
        </section>

        <section className="panel grid gap-3 rounded-3xl p-4">
          <h2 className="font-heading text-lg font-semibold">3. Extra stops or events</h2>
          {extras.map((extra, i) => (
            <div key={extra.id} className="grid gap-2 rounded-2xl bg-muted/50 p-3">
              <div className="flex gap-2">
                <Input value={extra.name} onChange={(event) => setExtras(extras.map((e) => (e.id === extra.id ? { ...e, name: event.target.value } : e)))} placeholder="Name (e.g. Menorah lighting)" aria-label={`Extra stop ${i + 1} name`} />
                <button type="button" aria-label="Remove extra stop" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted" onClick={() => setExtras(extras.filter((e) => e.id !== extra.id))}><X className="size-4" /></button>
              </div>
              <Input value={extra.address} onChange={(event) => setExtras(extras.map((e) => (e.id === extra.id ? { ...e, address: event.target.value, point: null } : e)))} placeholder="Address" aria-label={`Extra stop ${i + 1} address`} />
              <div className="flex flex-wrap gap-2">
                {useTimes ? <label className={field}><span className={label}>Fixed time (optional)</span><Input type="time" className="w-32" value={extra.time} onChange={(event) => setExtras(extras.map((e) => (e.id === extra.id ? { ...e, time: event.target.value } : e)))} aria-label={`Extra stop ${i + 1} time`} /></label> : null}
                <label className={field}><span className={label}>Day</span>
                  <select className="h-10 rounded-lg border bg-card px-2" value={extra.day} onChange={(event) => setExtras(extras.map((e) => (e.id === extra.id ? { ...e, day: Number(event.target.value) } : e)))} aria-label={`Extra stop ${i + 1} day`}>
                    {Array.from({ length: dayCount }, (_, d) => <option key={d} value={d}>Day {d + 1} · {dayLabel(dates[d]!)}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
          <Button type="button" className="justify-self-start rounded-full" onClick={() => setExtras([...extras, { id: `extra-${Date.now()}`, name: "", address: "", time: "", day: 0, point: null }])}><Plus className="size-4" /> Add a stop or event</Button>
        </section>

        <section className="panel grid gap-3 rounded-3xl p-4">
          <h2 className="font-heading text-lg font-semibold">4. Project</h2>
          <RouteProjectSelect data={data} className="h-10 justify-self-start" />
          {takenCount ? (
            <div className="grid gap-1 rounded-xl bg-violet-50 p-3 text-sm text-violet-900 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800">
              <p>{takenCount} {takenCount === 1 ? "contact is" : "contacts are"} already on another {project.projectName} route.</p>
              <label className="flex items-center gap-2"><input type="radio" checked={skipTaken} onChange={() => setSkipTaken(true)} /> Skip them</label>
              <label className="flex items-center gap-2"><input type="radio" checked={!skipTaken} onChange={() => setSkipTaken(false)} /> Include anyway</label>
            </div>
          ) : <p className="text-xs text-mutedink">No contacts here are on another {project.projectName || "Unsorted"} route.</p>}
          <Button type="button" className="h-11 rounded-full" disabled={pending} onClick={build}><RouteIcon className="size-4" /> {pending && !plan ? "Planning…" : plan ? "Plan again" : "Plan the trip"}</Button>
        </section>
      </div>

      {plan ? (
        <div className="mt-6 grid gap-4" aria-label="Trip plan">
          {plan.map((day, index) => {
            const pins: MapPin[] = day.stops.map((stop) => ({ id: stop.id, name: stop.name, address: stop.address, lat: stop.lat, lng: stop.lng, due: "ok", schedule: "", color: stop.kind === "extra" ? "#c026d3" : undefined }));
            const numbers = Object.fromEntries(day.stops.map((stop, i) => [stop.id, i + 1]));
            const line = [startPlace!, ...day.stops, ...(back ? [startPlace!] : [])].map((p) => ({ lat: p.lat, lng: p.lng }));
            const links = googleParts(startPlace!.label, [...day.stops.map((stop) => stop.address), ...(back ? [startPlace!.label] : [])]);
            const afterSunset = day.timed && day.sunset != null ? day.stops.filter((_, i) => day.times.arrivals[i]! > day.sunset!).length : 0;
            return (
              <section key={index} className="panel rounded-3xl p-4" aria-label={`Day ${index + 1}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-lg font-semibold">Day {index + 1} · {dayLabel(day.date)}</h2>
                    <p className="text-sm text-foreground">{day.timed ? <><strong>Leave {clock(day.times.leave)}</strong> · </> : null}{day.stops.length} stops · {day.times.miles} mi · {Math.floor(day.times.driveMinutes / 60)}h {day.times.driveMinutes % 60}m driving{day.timed ? ` · back ${day.times.back != null ? clock(day.times.back) : clock(day.times.end)}` : ""}</p>
                    <p className="text-xs text-mutedink">{day.matrix.source === "osrm" ? "Drive times from OSRM road data" : "Drive times estimated (straight line × 1.3 at 40 mph)"}{day.sunset != null ? ` · Sunset ${clock(day.sunset)}` : ""}{afterSunset ? ` · ${afterSunset} stops after sunset` : ""}</p>
                    {(day.timed ? day.times.warnings : []).map((warning) => <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
                  </div>
                </div>
                <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <ol className="grid min-w-0 max-h-[28rem] gap-1.5 overflow-auto pr-1">
                    {day.stops.map((stop, i) => (
                      <li key={stop.id} className={cn("flex min-w-0 flex-wrap items-center gap-2 rounded-xl sm:flex-nowrap bg-card p-2 ring-1 ring-foreground/8", stop.kind === "extra" && "ring-fuchsia-300 dark:ring-fuchsia-800")}>
                        <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-foreground" title={day.timed ? "Arrival" : "Drive from the last stop"}>{day.timed ? clock(day.times.arrivals[i]!) : <>{Math.round(day.matrix.minutes[i]?.[i + 1] ?? 0)} min<span className="block text-[10px] font-normal text-mutedink">drive</span></>}</span>
                        <div className="w-[calc(100%-4.5rem)] min-w-0 sm:w-auto sm:flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{i + 1}. {stop.name}{day.timed && stop.fixed != null ? <span className="ml-1 text-xs font-normal text-fuchsia-700 dark:text-fuchsia-300">fixed {clock(stop.fixed)}</span> : null}</p>
                          <p className="truncate text-xs text-mutedink">{stop.address}</p>
                          {stop.kind === "contact" && overlap.get(stop.id) ? <OverlapBadge text={overlapBadge(overlap.get(stop.id)!, project.projectName)} /> : null}
                        </div>
                        {plan.length > 1 ? (
                          <select aria-label={`Move ${stop.name}`} className="ml-[4.5rem] h-9 w-24 shrink-0 rounded-lg sm:ml-0 sm:w-20 border bg-card px-1 text-xs" value="" disabled={pending} onChange={(event) => tweak(index, stop.id, Number(event.target.value))}>
                            <option value="">Move…</option>
                            {plan.map((_, d) => (d === index ? null : <option key={d} value={d}>Day {d + 1}</option>))}
                          </select>
                        ) : null}
                        <button type="button" aria-label={`Remove ${stop.name}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-muted" disabled={pending} onClick={() => tweak(index, stop.id, "remove")}><Trash2 className="size-4" /></button>
                      </li>
                    ))}
                  </ol>
                  <div className="h-64 overflow-hidden rounded-2xl lg:h-auto lg:min-h-64">
                    <MapCanvas pins={pins} selected={[]} numbers={numbers} start={startPlace} routeLine={line} onOpen={() => {}} onVisit={() => {}} />
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  <label className="grid gap-1 text-sm"><span className={label}>Route name</span><Input value={names[index] ?? ""} onChange={(event) => setNames(names.map((n, j) => (j === index ? event.target.value : n)))} aria-label={`Day ${index + 1} route name`} /></label>
                  <div className="flex flex-wrap gap-2">
                    {data.viewer.canCreateRoute ? (
                      day.routeId ? <Link className="inline-flex h-10 items-center rounded-full bg-primary/10 px-4 text-sm text-primary" href={`/saved-routes/${day.routeId}`}>Saved · View route</Link>
                        : <Button type="button" className="rounded-full" disabled={pending || !day.stops.some((s) => s.kind === "contact")} onClick={() => saveDay(index)}><Save className="size-4" /> Save as route</Button>
                    ) : null}
                    {data.viewer.canManage ? (
                      <Button type="button" className="rounded-full" disabled={pending || !day.routeId || Boolean(day.plannerItems)} title={day.routeId ? "" : "Save the route first"} onClick={() => planDay(index)}><CalendarPlus className="size-4" /> {day.plannerItems ? "In the planner" : "Add to planner day"}</Button>
                    ) : null}
                    {links.parts.map((part) => <a key={part.url} href={part.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1 rounded-full bg-primary px-4 text-sm text-primary-foreground"><Navigation className="size-4" /> {part.label}</a>)}
                    {links.whole ? <a href={links.whole} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full px-3 text-sm text-link underline">Whole day (computer)</a> : null}
                  </div>
                </div>
              </section>
            );
          })}
          <div className="flex flex-wrap gap-2">
            {data.viewer.canCreateRoute && plan.length > 1 ? <Button type="button" className="rounded-full" disabled={pending || plan.every((day) => day.routeId || !day.stops.some((s) => s.kind === "contact"))} onClick={saveAll}><Save className="size-4" /> Save all {plan.length} days as routes</Button> : null}
            <Button type="button" variant="outline" className="rounded-full" onClick={() => router.push("/saved-routes")}>Back to Saved routes</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
