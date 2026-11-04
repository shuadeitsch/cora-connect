"use client";

import { useMemo, useState } from "react";
import type { AppData, HouseholdView } from "@/lib/types";
import { cn } from "@/lib/utils";

const PALETTE = ["#2563eb", "#db2777", "#ea580c", "#16a34a", "#9333ea", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#65a30d", "#c026d3", "#0d9488"];
export const NO_ROUTE = "#9ca3af";

export interface RouteTag { id: string; name: string; color: string; project: string; createdAt: string; stop: number }

/** Color by route: one pass over the routes already loaded (RLS-scoped), no extra queries. */
export function useRouteColoring(data: AppData) {
  const [on, setOn] = useState(true);
  const [project, setProject] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [show, setShow] = useState<"all" | "routes" | "none">("all");
  const [lines, setLines] = useState(true);

  const ordered = useMemo(() => [...data.routes].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)), [data.routes]);
  const colors = useMemo(() => new Map(ordered.map((route, index) => [route.id, PALETTE[index % PALETTE.length]])), [ordered]);
  const inProject = ordered.filter((route) => !project || (route.projectId ?? "") === (project === "unsorted" ? "" : project));
  const visible = inProject.filter((route) => !hidden.includes(route.id));
  const byHousehold = useMemo(() => {
    const map = new Map<string, RouteTag[]>();
    for (const route of visible) {
      route.stops.forEach((stop, index) => {
        const tags = map.get(stop.householdId) ?? [];
        tags.push({ id: route.id, name: route.name, color: colors.get(route.id)!, project: route.projectName, createdAt: route.createdAt, stop: index + 1 });
        map.set(stop.householdId, tags);
      });
    }
    for (const tags of map.values()) tags.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return map;
  }, [visible, colors]);

  function keep(household: HouseholdView) {
    if (!on || show === "all") return true;
    const onRoute = byHousehold.has(household.id);
    return show === "routes" ? onRoute : !onRoute;
  }
  function pinStyle(id: string) {
    if (!on) return {};
    const tags = byHousehold.get(id);
    if (!tags) return { color: NO_ROUTE };
    const [latest] = tags;
    return { color: latest.color, label: String(latest.stop), extra: tags.length - 1 || undefined, routes: tags };
  }
  const projects = [...new Map(ordered.map((route) => [route.projectId ?? "unsorted", route.projectName])).entries()];
  return { on, setOn, project, setProject, hidden, setHidden, show, setShow, lines, setLines, ordered, inProject, visible, colors, keep, pinStyle, projects };
}

export function RouteLegend({ ctl, className }: { ctl: ReturnType<typeof useRouteColoring>; className?: string }) {
  const pill = (active: boolean) => cn("rounded-full px-2.5 py-1 text-[11px] ring-1 ring-foreground/10", active ? "bg-primary text-primary-foreground" : "bg-card text-foreground");
  return (
    <div className={cn("grid gap-2 text-xs", className)} aria-label="Routes key">
      <label className="flex items-center gap-2 font-medium text-foreground">
        <input type="checkbox" checked={ctl.on} onChange={(event) => ctl.setOn(event.target.checked)} /> Color by route
      </label>
      {ctl.on ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <select aria-label="Route project" value={ctl.project} onChange={(event) => ctl.setProject(event.target.value)} className="h-8 rounded-full bg-card px-2 text-[11px] ring-1 ring-foreground/10">
              <option value="">All projects</option>
              {ctl.projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <button type="button" className={pill(ctl.show === "routes")} onClick={() => ctl.setShow(ctl.show === "routes" ? "all" : "routes")}>Only routes</button>
            <button type="button" className={pill(ctl.show === "none")} onClick={() => ctl.setShow(ctl.show === "none" ? "all" : "none")}>Not on a route</button>
            <label className="flex items-center gap-1 text-[11px] text-foreground"><input type="checkbox" checked={ctl.lines} onChange={(event) => ctl.setLines(event.target.checked)} /> Lines</label>
          </div>
          <ul className="grid max-h-56 gap-1 overflow-auto pr-1">
            {ctl.inProject.map((route) => (
              <li key={route.id}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!ctl.hidden.includes(route.id)} onChange={(event) => ctl.setHidden(event.target.checked ? ctl.hidden.filter((id) => id !== route.id) : [...ctl.hidden, route.id])} aria-label={`Show ${route.name}`} />
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: ctl.colors.get(route.id) }} />
                  <span className="min-w-0 flex-1 truncate text-foreground" title={route.name}>{route.name}</span>
                  <span className="shrink-0 text-[10px] text-mutedink">{route.projectName} · {route.stopCount}</span>
                </label>
              </li>
            ))}
            {!ctl.inProject.length ? <li className="text-mutedink">No routes in this project.</li> : null}
            <li className="flex items-center gap-2 text-mutedink"><span className="ml-5 size-2.5 rounded-full" style={{ background: NO_ROUTE }} /> Not on a route</li>
          </ul>
        </>
      ) : null}
    </div>
  );
}
