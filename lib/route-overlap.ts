"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { AppData, RouteView } from "@/lib/types";

/**
 * household id -> name of another route for the same project. Built in one pass from the routes this
 * person can already see (loaded under RLS), so hidden routes never flag anyone. Unsorted routes don't count.
 */
export function projectOverlap(routes: RouteView[], projectId: string, excludeRouteId?: string) {
  const map = new Map<string, string>();
  if (!projectId) return map;
  for (const route of routes) {
    if (route.projectId !== projectId || route.id === excludeRouteId) continue;
    for (const stop of route.stops) if (!map.has(stop.householdId)) map.set(stop.householdId, route.name);
  }
  return map;
}

export function overlapBadge(routeName: string, projectName: string) {
  return `Already on “${routeName}” · ${projectName}`;
}

// The project picked for a new route, shared by every builder on the page and remembered on this device.
const KEY = "cora.route.project";
const UNSET = "\u0000unset";
let current: string | null = null;
const listeners = new Set<() => void>();
function read() {
  if (current == null) {
    try { current = localStorage.getItem(KEY) ?? UNSET; } catch { current = UNSET; }
  }
  return current;
}
export function setRouteProject(id: string) {
  current = id;
  try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The chosen project; until one is picked, the project of the newest route that has one. "" means Unsorted. */
export function useRouteProject(data: AppData) {
  const stored = useSyncExternalStore(subscribe, read, () => UNSET);
  const fallback = useMemo(() => {
    const newest = [...data.routes].filter((route) => route.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return newest?.projectId ?? "";
  }, [data.routes]);
  const projectId = stored === "" ? "" : stored !== UNSET && data.projects.some((project) => project.id === stored) ? stored : fallback;
  const projectName = data.projects.find((project) => project.id === projectId)?.name ?? "";
  return { projectId, projectName, setProjectId: setRouteProject };
}

/** Overlap for the chosen project, recomputed only when routes or the project change. */
export function useOverlap(data: AppData, projectId: string, excludeRouteId?: string) {
  return useMemo(() => projectOverlap(data.routes, projectId, excludeRouteId), [data.routes, projectId, excludeRouteId]);
}
