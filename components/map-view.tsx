"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, X } from "lucide-react";
import { Notice } from "@/components/page-header";
import { TaggedRouteNotice } from "@/components/tagged-route-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MapPin } from "@/components/map-canvas";
import { saveRouteAction } from "@/lib/actions";
import { nearestNeighbor } from "@/lib/geo";
import type { AppData, HouseholdView } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map-canvas").then((mod) => mod.MapCanvas), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

export function MapView({ data }: { data: AppData }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState(false);
  const [stopIds, setStopIds] = useState<string[]>([]);
  const [routeName, setRouteName] = useState("");
  const [routeProject, setRouteProject] = useState("");
  const [optimized, setOptimized] = useState(false);
  const [activeRoute, setActiveRoute] = useState("");
  const [routesOpen, setRoutesOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    return data.households.filter((household) => {
      if (projectId && household.projectId !== projectId) return false;
      if (scheduleId && household.scheduleCategoryId !== scheduleId) return false;
      if (categoryId && !household.categoryIds.includes(categoryId)) return false;
      if (dueOnly && household.dueState !== "due" && household.dueState !== "overdue") return false;
      if (query && !`${household.name} ${household.city} ${household.zip}`.toLowerCase().includes(query.toLowerCase())) return false;
      return household.lat != null && household.lng != null;
    });
  }, [data.households, projectId, scheduleId, categoryId, dueOnly, query]);

  const active = data.routes.find((route) => route.id === activeRoute);
  const line = active
    ? active.stops.flatMap((stop) => (stop.lat != null && stop.lng != null ? [{ lat: stop.lat, lng: stop.lng }] : []))
    : stopIds.flatMap((id) => {
        const household = data.households.find((item) => item.id === id);
        return household?.lat != null && household.lng != null ? [{ lat: household.lat, lng: household.lng }] : [];
      });

  const numbers: Record<string, number> = {};
  (active ? active.stops.map((stop) => stop.householdId) : stopIds).forEach((id, index) => {
    numbers[id] = index + 1;
  });

  const pins: MapPin[] = filtered.map((household) => ({
    id: household.id,
    name: household.name,
    address: household.address,
    lat: household.lat!,
    lng: household.lng!,
    due: household.dueState === "overdue" ? "overdue" : household.dueState === "due" ? "due" : "ok",
    schedule: household.scheduleName,
  }));

  function addStop(id: string) {
    setBuilding(true);
    setActiveRoute("");
    setStopIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function orderStops() {
    const points = stopIds.map((id) => {
      const household = data.households.find((item) => item.id === id)!;
      return { id, lat: household.lat, lng: household.lng };
    });
    const start = data.org.startLat != null && data.org.startLng != null ? { lat: data.org.startLat, lng: data.org.startLng } : null;
    setStopIds(nearestNeighbor(start, points));
    setOptimized(true);
  }

  const contact = data.households.find((household) => household.id === contactId) ?? null;

  return (
    <div className="relative h-full min-h-[70dvh]">
      <MapCanvas
        pins={pins}
        selected={stopIds}
        numbers={numbers}
        start={data.org.startLat != null && data.org.startLng != null ? { lat: data.org.startLat, lng: data.org.startLng } : null}
        routeLine={line}
        onAdd={addStop}
        onOpen={setContactId}
        onVisit={(id) => router.push(`/reports?new=1&household=${id}`)}
      />
      <div className="pointer-events-none absolute inset-0 z-[500]">
        <div className="pointer-events-auto m-3 flex flex-wrap items-center gap-2">
          <select className="glass h-11 rounded-full px-3 text-sm" value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}>
            <option value="">All schedules</option>
            {data.categories.filter((category) => category.kind === "scheduled").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select className="glass h-11 rounded-full px-3 text-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {data.categories.filter((category) => category.kind === "regular").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <button type="button" className="glass inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm" onClick={() => setProjectId("")}>
            <span className="size-2 rounded-full bg-[#2f6bff]" />
            <select className="bg-transparent outline-none" value={projectId} onChange={(event) => setProjectId(event.target.value)} onClick={(event) => event.stopPropagation()}>
              <option value="">All projects</option>
              {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </button>
          <label className="glass inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm">
            <input type="checkbox" checked={dueOnly} onChange={(event) => setDueOnly(event.target.checked)} /> Due now
          </label>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Household or zip" className="glass h-11 w-44 rounded-full border-0" />
          {data.viewer.canCreateRoute ? (
            <Button className="h-11 rounded-full" onClick={() => { setBuilding(true); setActiveRoute(""); }}>Create Route</Button>
          ) : null}
        </div>
        <div className="glass pointer-events-auto absolute bottom-28 left-3 rounded-2xl px-3 py-2 text-[11px] lg:bottom-4">
          <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#0f766e]" /> On schedule</div>
          <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#f59e0b]" /> Due</div>
          <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#e11d48]" /> Overdue</div>
          <div className="flex items-center gap-2"><span className="size-2 rounded-sm bg-[#c4841d]" /> Start</div>
        </div>
        <button
          type="button"
          className="glass pointer-events-auto absolute bottom-48 left-3 inline-flex size-11 items-center justify-center rounded-2xl lg:bottom-24"
          aria-label="My location"
          onClick={() => {
            navigator.geolocation?.getCurrentPosition((pos) => {
              const map = document.querySelector(".leaflet-container") as HTMLElement | null;
              map?.dispatchEvent(new CustomEvent("cora-locate", { detail: pos.coords }));
            });
          }}
        >
          <LocateFixed className="size-4" />
        </button>
        <div className="pointer-events-auto absolute right-3 bottom-28 lg:bottom-4">
          <button type="button" className="h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground shadow" onClick={() => setRoutesOpen((open) => !open)}>
            Routes
          </button>
          {routesOpen ? (
            <div className="glass mt-2 max-h-64 w-64 overflow-auto rounded-2xl p-2 text-sm">
              {data.routes.map((route) => (
                <button key={route.id} type="button" className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={() => { setActiveRoute(route.id); setBuilding(false); }}>
                  <span className="font-medium text-foreground">{route.name}</span>
                  <span className="block text-xs text-mutedink">{route.stopCount} stops · {route.projectName}</span>
                </button>
              ))}
              {!data.routes.length ? <p className="px-2 py-3 text-xs text-mutedink">No saved routes yet.</p> : null}
            </div>
          ) : null}
        </div>
        {building ? (
          <aside className="glass pointer-events-auto absolute top-16 right-3 flex max-h-[70%] w-[min(100%-1.5rem,320px)] flex-col rounded-3xl p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-foreground">New route</h2>
              <button type="button" aria-label="Close route builder" onClick={() => setBuilding(false)}><X className="size-4" /></button>
            </div>
            <p className="mt-1 text-xs text-mutedink">Tap a pin and choose Add to route. Auto-order uses the nearest stop from your start point.</p>
            <div className="mt-2">
              <TaggedRouteNotice
                households={data.households}
                stops={stopIds.flatMap((id) => {
                  const household = data.households.find((item) => item.id === id);
                  return household ? [{ householdId: id, city: household.city, state: household.state }] : [];
                })}
              />
            </div>
            <Input className="mt-2" placeholder="Route name" value={routeName} onChange={(event) => setRouteName(event.target.value)} />
            <select className="mt-2 h-9 rounded-lg border px-2 text-sm" value={routeProject} onChange={(event) => setRouteProject(event.target.value)}>
              <option value="">Project</option>
              {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <ol className="mt-2 flex-1 space-y-1 overflow-auto text-sm">
              {stopIds.map((id, index) => {
                const household = data.households.find((item) => item.id === id);
                return (
                  <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-background px-2 py-1">
                    <span>{index + 1}. {household?.name}</span>
                    <button type="button" aria-label="Remove stop" onClick={() => setStopIds(stopIds.filter((stop) => stop !== id))}><X className="size-3.5" /></button>
                  </li>
                );
              })}
              {!stopIds.length ? <li className="py-4 text-center text-xs text-mutedink">No stops yet.</li> : null}
            </ol>
            {error ? <div className="mt-2"><Notice>{error}</Notice></div> : null}
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={orderStops} disabled={stopIds.length < 2}>Auto-order</Button>
              <Button
                type="button"
                className="rounded-full"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await saveRouteAction({ name: routeName, projectId: routeProject, optimized, householdIds: stopIds });
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setBuilding(false);
                    setStopIds([]);
                    setRouteName("");
                    router.push(`/saved-routes/${result.data?.id}`);
                    router.refresh();
                  });
                }}
              >
                {pending ? "Saving…" : "Save route"}
              </Button>
            </div>
          </aside>
        ) : null}
        {contact ? <ContactCard household={contact} onClose={() => setContactId("")} onAdd={() => addStop(contact.id)} /> : null}
      </div>
    </div>
  );
}

function ContactCard({ household, onClose, onAdd }: { household: HouseholdView; onClose: () => void; onAdd: () => void }) {
  return (
    <div className="glass pointer-events-auto absolute bottom-28 left-1/2 w-[min(100%-1.5rem,360px)] -translate-x-1/2 rounded-3xl p-3 lg:bottom-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-heading font-semibold text-foreground">{household.name}</p>
          <p className="text-xs text-mutedink">{household.address}</p>
          <p className="text-xs text-mutedink">{household.scheduleName}</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose}><X className="size-4" /></button>
      </div>
      <Button className="mt-2 rounded-full" onClick={onAdd}>Add to route</Button>
    </div>
  );
}
