"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ActiveFilterChips, ContactFilterControls, ContactStateTabs, cityKey, useContactFilters } from "@/components/contact-filters";
import { buildRouteAction, geocodeStartAction } from "@/lib/actions";
import { cityCentersAction } from "@/lib/city-actions";
import { byDistance, haversineMiles, nearestChain, type Point } from "@/lib/city-order";
import { stateLabel } from "@/lib/constants";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { overlapBadge, useOverlap, useRouteProject } from "@/lib/route-overlap";
import { OverlapBadge, RouteProjectSelect } from "@/components/route-project";

function suggestedName(data: AppData, ids: string[]) {
  const picked = data.households.filter((household) => ids.includes(household.id));
  const cities = [...new Set(picked.map((household) => household.city.trim()).filter(Boolean))];
  const day = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return cities.length === 1 ? `${cities[0]} route` : `Route ${day}`;
}

/** Name the route and save it (ordered nearest-first). Stays put afterwards; the toast has a View link. */
export function NameRouteForm({ data, ids, name: startName, onBack, onSaved }: { data: AppData; ids: string[]; name?: string; onBack?: () => void; onSaved?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(() => startName ?? suggestedName(data, ids));
  const { projectId, projectName, setProjectId } = useRouteProject(data);
  const overlap = useOverlap(data, projectId);
  const taken = ids.filter((id) => overlap.has(id));
  const [includeTaken, setIncludeTaken] = useState(false);
  const saveIds = includeTaken ? ids : ids.filter((id) => !overlap.has(id));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  function fail(message: string) {
    setError(message);
    toast({ title: message, tone: "error" });
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setError("");
        start(async () => {
          // Stay on this step until the database confirms the route; any failure is shown here and as a toast.
          let result: Awaited<ReturnType<typeof buildRouteAction>>;
          try {
            result = await buildRouteAction({ name, projectId, householdIds: saveIds });
          } catch {
            fail("The route didn't save. Check your connection, press Reload, and try again.");
            return;
          }
          if (!result?.ok) {
            fail(result?.error || "The route didn't save. Try again.");
            return;
          }
          if (!result.data?.id) {
            fail("The route didn't save. Try again.");
            return;
          }
          toast({ title: `Route saved: ${name.trim()}`, action: { label: "View", href: `/saved-routes/${result.data.id}` } });
          onSaved?.();
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-muted-foreground">{saveIds.length} stop{saveIds.length === 1 ? "" : "s"}, put in order from your start point.</p>
      <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Route name" aria-label="Route name" className="max-md:h-11 max-md:text-base" />
      {data.projects.length ? (
        <select className="h-10 rounded-lg border bg-card px-2 text-sm max-md:h-11 max-md:text-base" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Project">
          <option value="">Unsorted</option>
          {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      ) : null}
      {taken.length ? (
        <fieldset className="grid gap-1.5 rounded-xl bg-violet-50 p-3 text-sm text-violet-950 dark:bg-violet-950/40 dark:text-violet-100">
          <legend className="sr-only">Contacts already on a route</legend>
          <p className="font-medium" role="status">{taken.length} contact{taken.length === 1 ? " is" : "s are"} already on another {projectName} route</p>
          <ul className="max-h-24 overflow-y-auto text-xs">
            {taken.slice(0, 8).map((id) => <li key={id}>{data.households.find((h) => h.id === id)?.name ?? "Contact"}: {overlap.get(id)}</li>)}
            {taken.length > 8 ? <li>and {taken.length - 8} more</li> : null}
          </ul>
          <label className="flex items-center gap-2"><input type="radio" name="taken" checked={!includeTaken} onChange={() => setIncludeTaken(false)} /> Skip them</label>
          <label className="flex items-center gap-2"><input type="radio" name="taken" checked={includeTaken} onChange={() => setIncludeTaken(true)} /> Include anyway</label>
          {!saveIds.length ? <p className="text-xs">All of them are on another route. Choose Include anyway to save.</p> : null}
        </fieldset>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <div className="flex justify-end gap-2">
        {onBack ? <Button type="button" variant="outline" className="rounded-full max-md:h-11" onClick={onBack}>Back</Button> : null}
        <Button type="submit" className="rounded-full max-md:h-11 max-md:flex-1" disabled={pending || !saveIds.length || !name.trim()}>{pending ? "Saving…" : "Save route"}</Button>
      </div>
    </form>
  );
}

/** On phones the dialog is a full-width sheet pinned to the bottom, above the map and the keyboard-safe area. */
const phoneSheet =
  "sm:max-w-none md:max-w-md max-md:[&_[data-slot=dialog-close]]:size-11 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:p-5 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))] max-md:data-open:slide-in-from-bottom-10 max-md:data-open:zoom-in-100";

export function CreateRouteDialog({ data, ids, open, onClose, onSaved }: { data: AppData; ids: string[]; open: boolean; onClose: () => void; onSaved?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={phoneSheet}>
        <DialogHeader><DialogTitle className="font-heading text-foreground">New route</DialogTitle></DialogHeader>
        {open ? <NameRouteForm data={data} ids={ids} onSaved={() => { onClose(); onSaved?.(); }} /> : null}
      </DialogContent>
    </Dialog>
  );
}

const RECENT_KEY = "cora.cityRoute.recentStarts";
const CUSTOM = "__custom__";
const TYPE = "__type__";

/** Pick a city (in the open state tab); the route gets every contact there that shows on the contact list. */
export function CityRouteDialog({ data, open, onClose}: { data: AppData; open: boolean; onClose: () => void }) {
  const ctl = useContactFilters(data, "");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<{ key: string; label: string; ids: string[] } | null>(null);
  const cities = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; ids: string[] }>();
    for (const household of ctl.beforeCity) {
      const key = `${cityKey(household.city)}|${household.state.trim().toUpperCase()}`;
      const label = `${household.city.trim().replace(/\s+/g, " ") || "No city"}${ctl.filters.state ? "" : household.state ? `, ${household.state.trim()}` : ""}`;
      const group = groups.get(key) ?? { key, label, ids: [] };
      group.ids.push(household.id);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [ctl.beforeCity, ctl.filters.state]);
  const [order, setOrder] = useState<"az" | "distance" | "chain">("az");
  const [startKey, setStartKey] = useState("");
  const [centers, setCenters] = useState<Record<string, Point | null>>({});
  const [looking, setLooking] = useState(false);
  // Written-in starting place ("Portland, ME" or a street address), geocoded on demand.
  const [custom, setCustom] = useState<{ label: string; point: Point } | null>(null);
  const [typing, setTyping] = useState(false);
  const [placeText, setPlaceText] = useState("");
  const [placeError, setPlaceError] = useState("");
  const [placePending, setPlacePending] = useState(false);
  const [recent, setRecent] = useState<{ label: string; point: Point }[]>([]);
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5)); } catch { setRecent([]); }
  }, []);
  async function findPlace(text: string) {
    const label = text.trim().replace(/\s+/g, " ");
    if (!label) return;
    setPlacePending(true);
    setPlaceError("");
    const result = await geocodeStartAction(label);
    setPlacePending(false);
    if (!result.ok) { setPlaceError(`Couldn't find “${label}”. Try adding the town and state.`); return; }
    const entry = { label, point: { lat: result.data.lat, lng: result.data.lng } };
    setCustom(entry);
    setTyping(false);
    setPlaceText("");
    const next = [entry, ...recent.filter((item) => item.label.toLowerCase() !== label.toLowerCase())].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }
  // Fallback: the average of that city's contacts' saved coordinates.
  const averages = useMemo(() => {
    const out: Record<string, Point | null> = {};
    for (const city of cities) {
      const pts = data.households.filter((h) => city.ids.includes(h.id) && h.lat != null && h.lng != null);
      out[city.key] = pts.length ? { lat: pts.reduce((sum, h) => sum + h.lat!, 0) / pts.length, lng: pts.reduce((sum, h) => sum + h.lng!, 0) / pts.length } : null;
    }
    return out;
  }, [cities, data.households]);
  const points = useMemo(() => {
    const out: Record<string, Point | null> = {};
    for (const city of cities) out[city.key] = centers[city.key] ?? averages[city.key] ?? null;
    return out;
  }, [cities, centers, averages]);
  useEffect(() => {
    if (order === "az" || !open) return;
    const missing = cities.filter((city) => !(city.key in centers) && city.key.split("|")[0]);
    if (!missing.length) { setLooking(false); return; }
    let cancelled = false;
    setLooking(true);
    (async () => {
      for (let i = 0; i < missing.length && !cancelled; i += 10) {
        const chunk = missing.slice(i, i + 10).map((city) => {
          const [, state] = city.key.split("|");
          const name = data.households.find((h) => h.id === city.ids[0])?.city.trim() ?? "";
          return { key: city.key, city: name, state: state ?? "" };
        });
        const result = await cityCentersAction(chunk);
        if (cancelled) return;
        if (result.ok) setCenters((current) => ({ ...current, ...result.points }));
        else setCenters((current) => ({ ...current, ...Object.fromEntries(chunk.map((c) => [c.key, null])) }));
      }
      if (!cancelled) setLooking(false);
    })();
    return () => { cancelled = true; };
  }, [order, open, cities, centers, data.households]);
  const org = data.org;
  const origin: Point | null = org.startLat != null && org.startLng != null ? { lat: org.startLat, lng: org.startLng } : org.lat != null && org.lng != null ? { lat: org.lat, lng: org.lng } : null;
  const defaultStart = useMemo(() => {
    if (origin) {
      let best = "";
      let bestMiles = Infinity;
      for (const city of cities) {
        const point = points[city.key];
        if (!point) continue;
        const miles = haversineMiles(origin, point);
        if (miles < bestMiles) { bestMiles = miles; best = city.key; }
      }
      if (best) return best;
    }
    return cities[0]?.key ?? "";
  }, [cities, points, origin?.lat, origin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = custom ? CUSTOM : cities.some((city) => city.key === startKey) ? startKey : defaultStart;
  const sorted = useMemo(() => {
    if (order === "az") return cities;
    const keys = cities.map((city) => city.key);
    const all = custom ? { ...points, [CUSTOM]: custom.point } : points;
    const withStart = custom ? [CUSTOM, ...keys] : keys;
    const ranked = order === "chain" ? nearestChain(withStart, all, start) : byDistance(withStart, all, start);
    const byKey = new Map(cities.map((city) => [city.key, city]));
    return ranked.filter((key) => key !== CUSTOM).map((key) => byKey.get(key)!);
  }, [order, cities, points, start, custom]);
  const milesFrom = (key: string, index: number) => {
    if (order === "az") return null;
    const startPoint = custom ? custom.point : points[start];
    const from = order === "chain" ? (index > 0 ? points[sorted[index - 1]!.key] : custom ? custom.point : null) : startPoint;
    const to = points[key];
    if (!to) return "location unknown";
    if (key === start && order === "distance") return "start";
    if (!from) return order === "chain" ? "start" : null;
    return `${Math.round(haversineMiles(from, to))} mi`;
  };
  const shown = sorted.filter((city) => city.label.toLowerCase().includes(search.trim().toLowerCase()));
  const current = chosen;
  const [checked, setChecked] = useState<string[]>([]);
  const { projectId: cityProject, projectName: cityProjectName } = useRouteProject(data);
  const cityOverlap = useOverlap(data, cityProject);
  const picked = sorted.filter((city) => checked.includes(city.key));
  const pickedIds = [...new Set(picked.flatMap((city) => city.ids))];
  const toggleCity = (key: string) => setChecked((list) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]));
  const routeName = picked.length === 1 ? `${picked[0]!.label} route` : picked.length <= 3 ? `${picked.map((city) => city.label.split(",")[0]).join(", ")} route` : `${picked.length} cities route`;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setChosen(null); setChecked([]); setSearch(""); onClose(); } }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">{current ? current.label : "New route by city"}</DialogTitle>
        </DialogHeader>
        {current ? (
          <NameRouteForm key={current.key} data={data} ids={current.ids} name={`${current.label} route`} onBack={() => setChosen(null)} onSaved={() => { setChosen(null); setChecked([]); setSearch(""); onClose(); }} />
        ) : (
          <div className="grid gap-3">
            <ContactStateTabs ctl={ctl} />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search or type a city" aria-label="Search cities" />
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-9 rounded-full border bg-card px-3 text-sm" value={order} onChange={(event) => setOrder(event.target.value as typeof order)} aria-label="Sort cities">
                <option value="az">A–Z</option>
                <option value="distance">By distance</option>
                <option value="chain">Nearest-next chain</option>
              </select>
              {order !== "az" ? (
                <select
                  className="h-9 min-w-0 max-w-full rounded-full border bg-card px-3 text-sm"
                  value={typing ? TYPE : custom ? `recent:${custom.label}` : start}
                  aria-label="Starting city"
                  onChange={(event) => {
                    const value = event.target.value;
                    setPlaceError("");
                    if (value === TYPE) { setTyping(true); return; }
                    setTyping(false);
                    if (value.startsWith("recent:")) {
                      const hit = recent.find((item) => `recent:${item.label}` === value);
                      if (hit) setCustom(hit);
                      return;
                    }
                    setCustom(null);
                    setStartKey(value);
                  }}
                >
                  {cities.map((city) => <option key={city.key} value={city.key}>From {city.label}</option>)}
                  {recent.length ? (
                    <optgroup label="Recent">
                      {recent.map((item) => <option key={item.label} value={`recent:${item.label}`}>From {item.label}</option>)}
                    </optgroup>
                  ) : null}
                  {custom && !recent.some((item) => item.label === custom.label) ? <option value={`recent:${custom.label}`}>From {custom.label}</option> : null}
                  <option value={TYPE}>Type a city or address…</option>
                </select>
              ) : null}
              <RouteProjectSelect data={data} />
              {looking ? <span className="text-xs text-muted-foreground">Finding city locations…</span> : null}
            </div>
            {order !== "az" && typing ? (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => { event.preventDefault(); void findPlace(placeText); }}
              >
                <Input
                  autoFocus
                  value={placeText}
                  onChange={(event) => setPlaceText(event.target.value)}
                  placeholder="e.g. Portland, ME or 12 Main St, Saco, ME"
                  aria-label="Starting place"
                  className="h-9 min-w-0 flex-1 rounded-full"
                />
                <Button type="submit" className="h-9 rounded-full" disabled={placePending || !placeText.trim()}>{placePending ? "Finding…" : "Use"}</Button>
                <Button type="button" variant="outline" className="h-9 rounded-full" onClick={() => { setTyping(false); setPlaceError(""); }}>Cancel</Button>
              </form>
            ) : null}
            {placeError ? <p role="alert" className="text-sm text-red-600">{placeError}</p> : null}
            <ul className="max-h-[50vh] divide-y overflow-auto rounded-xl border">
              {shown.map((city) => {
                const miles = milesFrom(city.key, sorted.indexOf(city));
                return (
                <li key={city.key}>
                  <label className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted">
                    <input type="checkbox" className="size-4 shrink-0 accent-[#0f766e]" checked={checked.includes(city.key)} onChange={() => toggleCity(city.key)} aria-label={city.label} />
                    <span className="min-w-0 flex-1 font-medium text-foreground">
                      {city.label}{miles ? <span className="font-normal text-muted-foreground"> · {miles}</span> : null}
                      {(() => {
                        const n = city.ids.filter((id) => cityOverlap.has(id)).length;
                        return n ? <span className="block"><OverlapBadge text={`${n} already on another ${cityProjectName} route`} /></span> : null;
                      })()}
                    </span>
                    <span className="text-xs text-muted-foreground">{city.ids.length}</span>
                  </label>
                </li>
                );
              })}
              {!shown.length ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No contacts in {search.trim() || (ctl.filters.state ? stateLabel(ctl.filters.state) : "this list")}.</li> : null}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground" aria-live="polite">{picked.length} cit{picked.length === 1 ? "y" : "ies"} · {pickedIds.length} contact{pickedIds.length === 1 ? "" : "s"}</span>
              <Button type="button" variant="outline" className="h-9 rounded-full" disabled={!shown.length} onClick={() => setChecked((list) => [...new Set([...list, ...shown.map((city) => city.key)])])}>Select all</Button>
              {picked.length ? <Button type="button" variant="outline" className="h-9 rounded-full" onClick={() => setChecked([])}>Clear</Button> : null}
              <Button type="button" className="ml-auto h-9 rounded-full" disabled={!pickedIds.length} onClick={() => setChosen({ key: picked.map((city) => city.key).join("+"), label: routeName.replace(/ route$/, ""), ids: pickedIds })}>Create route</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Tick contacts from a filtered list, then name and save the route. */
export function PickContactsDialog({ data, open, onClose }: { data: AppData; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const ctl = useContactFilters(data, query);
  const [picked, setPicked] = useState<string[]>([]);
  const [naming, setNaming] = useState(false);
  const { projectId, projectName } = useRouteProject(data);
  const overlap = useOverlap(data, projectId);
  const shown = ctl.matched;
  const allShown = shown.length > 0 && shown.every((household) => picked.includes(household.id));
  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setNaming(false); setPicked([]); setQuery(""); onClose(); } }}>
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-heading text-foreground">{naming ? "New route" : "Pick contacts"}</DialogTitle></DialogHeader>
        {naming ? (
          <NameRouteForm data={data} ids={picked} onBack={() => setNaming(false)} onSaved={() => { setNaming(false); setPicked([]); setQuery(""); onClose(); }} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ContactStateTabs ctl={ctl} />
              <ContactFilterControls ctl={ctl} />
              <ActiveFilterChips ctl={ctl} />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts" aria-label="Search contacts" className="h-10 w-44 rounded-full" />
              <RouteProjectSelect data={data} />
            </div>
            <ul className="min-h-40 flex-1 divide-y overflow-auto rounded-xl border">
              {shown.map((household) => {
                const on = picked.includes(household.id);
                return (
                  <li key={household.id}>
                    <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted", on && "bg-primary/5")}>
                      <input type="checkbox" className="size-4 accent-[#0f766e]" checked={on} onChange={() => toggle(household.id)} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{household.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{household.address || "No address"}</span>
                        <OverlapBadge text={overlap.has(household.id) ? overlapBadge(overlap.get(household.id)!, projectName) : undefined} />
                      </span>
                    </label>
                  </li>
                );
              })}
              {!shown.length ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No contacts match.</li> : null}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{picked.length} selected</span>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full"
                disabled={!shown.length}
                onClick={() => setPicked((current) => allShown
                  ? current.filter((id) => !shown.some((household) => household.id === id))
                  : [...current, ...shown.map((household) => household.id).filter((id) => !current.includes(id))])}
              >
                {allShown ? "Unselect shown" : `Select all shown (${shown.length})`}
              </Button>
              {picked.length ? <Button type="button" variant="outline" className="h-9 rounded-full" onClick={() => setPicked([])}>Clear</Button> : null}
              <Button type="button" className="ml-auto h-9 rounded-full" disabled={!picked.length} onClick={() => setNaming(true)}>Create route</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
