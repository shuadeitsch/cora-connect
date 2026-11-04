import { GeoLocation, Zmanim } from "@hebcal/core";
import { miles, quickestOrder } from "@/lib/geo";

export type Pt = { lat: number; lng: number };
export interface TripStop {
  id: string;
  kind: "contact" | "extra";
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Fixed arrival, minutes after midnight (extras only). */
  fixed?: number;
  /** Day index chosen for an extra. */
  day?: number;
}
export interface Matrix { minutes: number[][]; miles: number[][]; source: "osrm" | "estimate" }
export interface DayTimes {
  leave: number;
  arrivals: number[];
  back: number | null;
  driveMinutes: number;
  miles: number;
  end: number;
  warnings: string[];
}

/** Split contacts into `days` groups by sweeping around the start (cut at the widest empty wedge), with equal visit counts. */
export function splitByAngle(start: Pt, contacts: TripStop[], days: number): TripStop[][] {
  if (days <= 1 || contacts.length <= 1) return [contacts, ...Array.from({ length: Math.max(0, days - 1) }, () => [])];
  const withAngle = contacts.map((stop) => ({ stop, a: Math.atan2(stop.lat - start.lat, (stop.lng - start.lng) * Math.cos((start.lat * Math.PI) / 180)) })).sort((x, y) => x.a - y.a);
  let cut = 0;
  let widest = -1;
  for (let i = 0; i < withAngle.length; i++) {
    const next = withAngle[(i + 1) % withAngle.length]!.a + (i + 1 === withAngle.length ? 2 * Math.PI : 0);
    const gap = next - withAngle[i]!.a;
    if (gap > widest) { widest = gap; cut = (i + 1) % withAngle.length; }
  }
  const ring = [...withAngle.slice(cut), ...withAngle.slice(0, cut)].map((entry) => entry.stop);
  const out: TripStop[][] = [];
  for (let d = 0; d < days; d++) out.push(ring.slice(Math.round((d * ring.length) / days), Math.round(((d + 1) * ring.length) / days)));
  // Nearer group first.
  const dist = (group: TripStop[]) => (group.length ? group.reduce((sum, stop) => sum + miles(start, stop), 0) / group.length : Infinity);
  return out.sort((a, b) => dist(a) - dist(b));
}

/** Order a day's contacts with the existing optimizer, then put each extra stop where it adds the least driving. */
export function orderDay(start: Pt, stops: TripStop[], back: boolean): TripStop[] {
  const contacts = stops.filter((stop) => stop.kind === "contact");
  const byId = new Map(contacts.map((stop) => [stop.id, stop]));
  const path = quickestOrder(start, contacts).map((id) => byId.get(id)!);
  for (const extra of stops.filter((stop) => stop.kind === "extra")) {
    let best = path.length;
    let bestCost = Infinity;
    for (let i = 0; i <= path.length; i++) {
      const prev = i === 0 ? start : path[i - 1]!;
      const next = i < path.length ? path[i]! : back ? start : null;
      const cost = miles(prev, extra) + (next ? miles(extra, next) - miles(prev, next) : 0);
      if (cost < bestCost) { bestCost = cost; best = i; }
    }
    path.splice(best, 0, extra);
  }
  return path;
}

/** Times for a day. Matrix index 0 is the start, then the stops in order. Fixed-time stops set the leave time (scheduled backward). */
export function scheduleDay(stops: TripStop[], matrix: Matrix, opts: { visit: number; startAt?: number | null; finishBy?: number | null; back: boolean }): DayTimes {
  const drive = (i: number, j: number) => matrix.minutes[i]?.[j] ?? 0;
  const dist = (i: number, j: number) => matrix.miles[i]?.[j] ?? 0;
  const visitOf = (stop: TripStop) => (stop.kind === "extra" ? (stop.fixed != null ? 30 : opts.visit) : opts.visit);
  // Offsets from leaving, with no waiting.
  const offsets: number[] = [];
  let t = 0;
  stops.forEach((stop, index) => { t += drive(index, index + 1); offsets.push(t); t += visitOf(stop); });
  const lastIndex = stops.length;
  const backDrive = opts.back && stops.length ? drive(lastIndex, 0) : 0;
  const total = t + backDrive;
  const fixedIdx = stops.findIndex((stop) => stop.fixed != null);
  let leave: number;
  const warnings: string[] = [];
  if (fixedIdx >= 0) {
    leave = stops[fixedIdx]!.fixed! - offsets[fixedIdx]!;
    if (opts.startAt != null && leave < opts.startAt) warnings.push(`To make ${stops[fixedIdx]!.name} on time you'd leave before your start time.`);
  } else if (opts.finishBy != null) leave = opts.finishBy - total;
  else leave = opts.startAt ?? 10 * 60;
  // Forward pass, waiting for later fixed stops.
  const arrivals: number[] = [];
  let now = leave;
  let driveMinutes = 0;
  let totalMiles = 0;
  stops.forEach((stop, index) => {
    const d = drive(index, index + 1);
    driveMinutes += d;
    totalMiles += dist(index, index + 1);
    now += d;
    if (stop.fixed != null && now < stop.fixed) now = stop.fixed;
    if (stop.fixed != null && now > stop.fixed + 1) warnings.push(`Arrives at ${stop.name} ${Math.round(now - stop.fixed)} min late.`);
    arrivals.push(now);
    now += visitOf(stop);
  });
  let back: number | null = null;
  if (opts.back && stops.length) {
    driveMinutes += backDrive;
    totalMiles += dist(lastIndex, 0);
    now += backDrive;
    back = now;
  }
  if (opts.finishBy != null && now > opts.finishBy + 1) warnings.push(`Ends at ${clock(now)}, after your finish time.`);
  if (now > 21 * 60) warnings.push(`Ends late (${clock(now)}). Consider moving stops to another day.`);
  return { leave, arrivals, back, driveMinutes: Math.round(driveMinutes), miles: Math.round(totalMiles * 10) / 10, end: now, warnings };
}

export function clock(minutes: number) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Sunset at the start place on that date, in minutes after local midnight (America/New_York). */
export function sunsetMinutes(date: string, at: Pt, tz = "America/New_York"): number | null {
  try {
    const [y, m, d] = date.split("-").map(Number);
    const sunset = new Zmanim(new GeoLocation(null, at.lat, at.lng, 0, tz), new Date(y!, m! - 1, d!, 12), false).sunset();
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(sunset);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return get("hour") * 60 + get("minute");
  } catch {
    return null;
  }
}
