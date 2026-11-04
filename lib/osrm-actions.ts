"use server";

import { getCurrentUser } from "@/lib/session";

type P = { lat: number; lng: number };
export type DriveMatrix = { minutes: number[][]; miles: number[][]; source: "osrm" | "estimate" };

const cache = new Map<string, { minutes: number[][]; miles: number[][] }>();

function estimate(points: P[]): DriveMatrix {
  const rad = (n: number) => (n * Math.PI) / 180;
  const hav = (a: P, b: P) => {
    const s = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(s)));
  };
  const miles = points.map((a) => points.map((b) => hav(a, b) * 1.3));
  return { miles, minutes: miles.map((row) => row.map((m) => (m / 40) * 60)), source: "estimate" };
}

/** Drive minutes and miles between every pair of points, from the public OSRM demo server (cached per server instance); straight-line × 1.3 at 40 mph if it's unavailable. Nothing is saved. */
export async function driveMatrixAction(points: P[]): Promise<DriveMatrix> {
  const user = await getCurrentUser();
  if (!user) return estimate([]);
  const list = points.slice(0, 100).map((p) => ({ lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 }));
  if (list.length < 2) return estimate(list);
  const key = list.map((p) => `${p.lng},${p.lat}`).join(";");
  const hit = cache.get(key);
  if (hit) return { ...hit, source: "osrm" };
  try {
    const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${key}?annotations=duration,distance`, {
      headers: { "User-Agent": "CoraConnect/1.0 (route planner)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return estimate(list);
    const json = (await res.json()) as { code: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
    if (json.code !== "Ok" || !json.durations || !json.distances) return estimate(list);
    const fallback = estimate(list);
    const minutes = json.durations.map((row, i) => row.map((s, j) => (s == null ? fallback.minutes[i]![j]! : s / 60)));
    const miles = json.distances.map((row, i) => row.map((m, j) => (m == null ? fallback.miles[i]![j]! : m / 1609.344)));
    if (cache.size > 200) cache.clear();
    cache.set(key, { minutes, miles });
    return { minutes, miles, source: "osrm" };
  } catch {
    return estimate(list);
  }
}
