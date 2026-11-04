"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, Plus, Shuffle, X } from "lucide-react";
import { Notice } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cityKey, useContactFilters } from "@/components/contact-filters";
import { saveRouteAction } from "@/lib/actions";
import { nearestNeighbor } from "@/lib/geo";
import type { AppData, RouteView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { overlapBadge, useOverlap } from "@/lib/route-overlap";
import { OverlapBadge } from "@/components/route-project";

type Point = { lat: number; lng: number } | null;

/** Edit a saved route: name, project, stops (add, remove, reorder) and re-optimize. Nothing is saved until Save. */
export function RouteEditor({
  data,
  route,
  pointOf,
  onDone,
  onSaved,
}: {
  data: AppData;
  route: RouteView;
  pointOf: (householdId: string) => Point;
  onDone: () => void;
  onSaved?: (name: string, projectId: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, run] = useTransition();
  const [name, setName] = useState(route.name);
  const [projectId, setProjectId] = useState(route.projectId ?? "");
  const [ids, setIds] = useState(() => route.stops.map((stop) => stop.householdId));
  const [optimized, setOptimized] = useState(route.optimized);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [cityNote, setCityNote] = useState("");
  const overlap = useOverlap(data, projectId, route.id);
  const projectName = data.projects.find((project) => project.id === projectId)?.name ?? "";
  const badge = (id: string) => (overlap.has(id) ? overlapBadge(overlap.get(id)!, projectName) : undefined);
  const original = useMemo(() => new Set(route.stops.map((stop) => stop.householdId)), [route.stops]);
  // Only stops added in this edit are flagged; ones already on the route stay unless removed by hand.
  const takenNew = ids.filter((id) => !original.has(id) && overlap.has(id));
  const [includeTaken, setIncludeTaken] = useState(false);
  const saveIds = includeTaken ? ids : ids.filter((id) => !takenNew.includes(id));
  // Same list rules as New route by city: role access, and contacts with hidden tags left out.
  const ctl = useContactFilters(data, "");
  const cities = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; ids: string[] }>();
    for (const household of ctl.beforeCity) {
      const key = `${cityKey(household.city)}|${household.state.trim().toUpperCase()}`;
      const group = groups.get(key) ?? { key, label: `${household.city.trim().replace(/\s+/g, " ") || "No city"}${household.state ? `, ${household.state.trim()}` : ""}`, ids: [] };
      group.ids.push(household.id);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [ctl.beforeCity]);
  function addCity(key: string) {
    const city = cities.find((item) => item.key === key);
    if (!city) return;
    const fresh = city.ids.filter((id) => !ids.includes(id));
    if (fresh.length) change([...ids, ...fresh]);
    const skipped = city.ids.length - fresh.length;
    const elsewhere = fresh.filter((id) => overlap.has(id)).length;
    setCityNote(`Added ${fresh.length} from ${city.label}${skipped ? ` (${skipped} already on the route)` : ""}.${elsewhere ? ` ${elsewhere} of them already on another ${projectName} route.` : ""}`);
  }

  const byId = useMemo(() => {
    const map = new Map<string, { name: string; city: string; state: string; street: string }>();
    for (const stop of route.stops) map.set(stop.householdId, stop);
    for (const household of data.households) map.set(household.id, household);
    return map;
  }, [data.households, route.stops]);

  const matches = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const inRoute = new Set(ids);
    return data.households
      .filter((household) => !inRoute.has(household.id))
      .filter((household) => {
        const text = `${household.name} ${household.street} ${household.city} ${household.state}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .slice(0, 20);
  }, [data.households, ids, search]);

  function change(next: string[]) {
    setIds(next);
    setOptimized(false);
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    change(next);
  }
  function reoptimize() {
    const start = data.org.startLat != null && data.org.startLng != null ? { lat: data.org.startLat, lng: data.org.startLng } : null;
    setIds(nearestNeighbor(start, ids.map((id) => ({ id, lat: pointOf(id)?.lat ?? null, lng: pointOf(id)?.lng ?? null }))));
    setOptimized(true);
  }
  function save() {
    setError("");
    if (!name.trim()) return setError("Name the route.");
    if (!saveIds.length) return setError("Add at least one stop.");
    run(async () => {
      let result: Awaited<ReturnType<typeof saveRouteAction>>;
      try {
        result = await saveRouteAction({ id: route.id, name, projectId, optimized, householdIds: saveIds });
      } catch {
        result = { ok: false, error: "The route wasn't saved: the connection dropped. Try again." };
      }
      if (!result.ok) {
        setError(result.error);
        toast({ title: result.error, tone: "error" });
        return;
      }
      toast({ title: `Route saved: ${name.trim()}` });
      onSaved?.(name, projectId);
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="mt-3 grid gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/8">
      <h2 className="font-heading font-semibold text-foreground">Edit route</h2>
      <Input value={name} onChange={(event) => setName(event.target.value)} aria-label="Route name" placeholder="Route name" className="max-md:h-11 max-md:text-base" />
      {data.projects.length ? (
        <select className="h-10 rounded-lg border bg-card px-2 text-sm max-md:h-11 max-md:text-base" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Project">
          <option value="">Unsorted</option>
          {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{ids.length} stop{ids.length === 1 ? "" : "s"}</p>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={reoptimize} disabled={ids.length < 2}>
          <Shuffle className="size-4" /> Re-optimize order
        </Button>
      </div>
      <ol className="grid gap-1" aria-label="Stops">
        {ids.map((id, index) => {
          const stop = byId.get(id);
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragging(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (dragging != null) move(dragging, index); setDragging(null); }}
              onDragEnd={() => setDragging(null)}
              className={cn("flex items-center gap-1.5 rounded-lg bg-background px-1.5 py-1 text-sm", dragging === index && "opacity-50")}
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground max-md:hidden" aria-hidden />
              <span className="w-5 shrink-0 text-center font-semibold text-primary">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-foreground">{stop?.name ?? "Contact"}</span>{" "}
                <span className="text-xs text-muted-foreground">{stop?.city}</span>
                {badge(id) ? <span className="block"><OverlapBadge text={badge(id)} /></span> : null}
              </span>
              <button type="button" aria-label={`Move ${stop?.name ?? "stop"} up`} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-accent disabled:opacity-30" disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp className="size-4" /></button>
              <button type="button" aria-label={`Move ${stop?.name ?? "stop"} down`} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-accent disabled:opacity-30" disabled={index === ids.length - 1} onClick={() => move(index, index + 1)}><ArrowDown className="size-4" /></button>
              <button type="button" aria-label={`Remove ${stop?.name ?? "stop"}`} className="inline-flex size-9 items-center justify-center rounded-full text-destructive hover:bg-accent" onClick={() => change(ids.filter((item) => item !== id))}><X className="size-4" /></button>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-1">
        <select
          className="h-10 rounded-lg border bg-card px-2 text-sm max-md:h-11 max-md:text-base"
          value=""
          aria-label="Add a city"
          onChange={(event) => addCity(event.target.value)}
        >
          <option value="">Add a city…</option>
          {cities.map((city) => <option key={city.key} value={city.key}>{city.label} ({city.ids.length})</option>)}
        </select>
        {cityNote ? <p className="px-1 text-xs text-muted-foreground" role="status">{cityNote}</p> : null}
      </div>
      <div className="grid gap-1">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Add a stop: search name, street or city" aria-label="Add a stop" className="max-md:h-11 max-md:text-base" />
        {search.trim() ? (
          matches.length ? (
            <ul className="grid max-h-64 gap-1 overflow-y-auto">
              {matches.map((household) => (
                <li key={household.id}>
                  <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent" onClick={() => change([...ids, household.id])}>
                    <Plus className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 truncate"><span className="font-medium text-foreground">{household.name}</span> <span className="text-xs text-muted-foreground">{household.street}, {household.city}</span><OverlapBadge text={badge(household.id)} /></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="px-2 text-sm text-muted-foreground">No contacts match.</p>
        ) : null}
      </div>
      {takenNew.length ? (
        <fieldset className="grid gap-1.5 rounded-xl bg-violet-50 p-3 text-sm text-violet-950 dark:bg-violet-950/40 dark:text-violet-100">
          <legend className="sr-only">Contacts already on a route</legend>
          <p className="font-medium" role="status">{takenNew.length} contact{takenNew.length === 1 ? " is" : "s are"} already on another {projectName} route</p>
          <label className="flex items-center gap-2"><input type="radio" name="edit-taken" checked={!includeTaken} onChange={() => setIncludeTaken(false)} /> Skip them</label>
          <label className="flex items-center gap-2"><input type="radio" name="edit-taken" checked={includeTaken} onChange={() => setIncludeTaken(true)} /> Include anyway</label>
        </fieldset>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="rounded-full max-md:h-11" onClick={onDone} disabled={pending}>Cancel</Button>
        <Button type="button" className="rounded-full max-md:h-11 max-md:flex-1" onClick={save} disabled={pending || !name.trim() || !saveIds.length}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
