"use client";

import { isNewContact } from "@/lib/new-contacts";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATES: { code: string; name: string }[] = [
  { code: "ME", name: "Maine" },
  { code: "NH", name: "New Hampshire" },
  { code: "WI", name: "Wisconsin" },
];
const KEY = "cora.dashboard.admin";
type Metric = "visits" | "contacts";

function stateCode(raw: string) {
  const value = raw.trim().toUpperCase();
  const hit = STATES.find((state) => state.code === value || state.name.toUpperCase() === value);
  return hit?.code ?? "";
}

/** Admin dashboard: Visits and New contacts cards with Project and State filters, and a state × project table. */
export function AdminBreakdown({ data }: { data: AppData }) {
  const projects = useMemo(() => data.projects.map((project) => project.name).filter((name) => name.trim()).sort(newestFirst), [data.projects]);
  const [project, setProject] = useState("All");
  const [state, setState] = useState("All");
  const [metric, setMetric] = useState<Metric>("visits");
  const [pivot, setPivot] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as { project?: string; state?: string; metric?: Metric; pivot?: boolean };
      if (saved.project && (saved.project === "All" || projects.includes(saved.project))) setProject(saved.project);
      if (saved.state && (saved.state === "All" || STATES.some((item) => item.code === saved.state))) setState(saved.state);
      if (saved.metric === "visits" || saved.metric === "contacts") setMetric(saved.metric);
      if (typeof saved.pivot === "boolean") setPivot(saved.pivot);
    } catch {}
  }, [projects]);
  useEffect(() => {
    window.localStorage.setItem(KEY, JSON.stringify({ project, state, metric, pivot }));
  }, [project, state, metric, pivot]);

  // counts[metric][state][project]
  const counts = useMemo(() => {
    const known = new Map(projects.map((name) => [name.trim().toLowerCase(), name]));
    const byId = new Map(data.projects.map((item) => [item.id, item.name]));
    const make = () => new Map<string, Map<string, number>>();
    const result = { visits: make(), contacts: make() };
    const add = (table: Map<string, Map<string, number>>, st: string, pr: string) => {
      const row = table.get(st) ?? new Map<string, number>();
      row.set(pr, (row.get(pr) ?? 0) + 1);
      table.set(st, row);
    };
    for (const household of data.households) {
      const st = stateCode(household.state) || "—";
      const pr = household.projectId ? byId.get(household.projectId) ?? "Unsorted" : "Unsorted";
      if (isNewContact(household)) add(result.contacts, st, pr);
      for (const visit of household.contactVisits) {
        if (visit.status !== "completed") continue;
        const name = known.get(visit.visited.trim().toLowerCase());
        if (name) add(result.visits, st, name);
      }
    }
    return result;
  }, [data.households, data.projects, projects]);

  function total(m: Metric, st: string, pr: string) {
    let sum = 0;
    for (const [rowState, row] of counts[m]) {
      if (st !== "All" && rowState !== st) continue;
      for (const [rowProject, n] of row) if (pr === "All" || rowProject === pr) sum += n;
    }
    return sum;
  }

  const columnsProjects = [...projects, ...(metric === "contacts" ? ["Unsorted"] : [])];
  const stateRows = [...STATES.map((item) => item.code), ...(counts[metric].has("—") ? ["—"] : [])];
  const rows = pivot ? columnsProjects : stateRows;
  const cols = pivot ? stateRows : columnsProjects;
  const stateLabel = (code: string) => STATES.find((item) => item.code === code)?.name ?? "No state";
  const label = (value: string, isState: boolean) => (isState ? stateLabel(value) : value);
  const cell = (r: string, c: string) => (pivot ? total(metric, c, r) : total(metric, r, c));
  function pick(r: string, c: string) {
    const st = pivot ? c : r;
    const pr = pivot ? r : c;
    if (st !== "—") setState(st);
    if (pr !== "Unsorted") setProject(pr);
  }
  const scope = `${project === "All" ? "All projects" : project} · ${state === "All" ? "All states" : stateLabel(state)}`;
  const select = "h-9 min-w-0 rounded-lg border bg-background px-2 text-sm text-foreground";

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center gap-2 rounded-3xl p-3">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">Project
          <select aria-label="Project filter" className={select} value={project} onChange={(event) => setProject(event.target.value)}>
            <option value="All">All</option>
            {projects.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">State
          <select aria-label="State filter" className={select} value={state} onChange={(event) => setState(event.target.value)}>
            <option value="All">All</option>
            {STATES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
        </label>
        {project !== "All" || state !== "All" ? <button type="button" className="text-sm text-link underline" onClick={() => { setProject("All"); setState("All"); }}>Clear</button> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Visits" value={total("visits", state, project)} hint={`Completed visits · ${scope}`} href="/reports" link="View report" />
        <Card title="New contacts" value={total("contacts", state, project)} hint={`Added since Nov 4, 2026, not imports · ${scope}`} href="/households" link="View contacts" />
      </div>
      <section className="panel rounded-3xl p-4" aria-label="Breakdown">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">Breakdown</h2>
          <div className="flex flex-wrap gap-1.5">
            <div className="inline-flex rounded-full bg-muted p-0.5 text-sm" role="group" aria-label="Count">
              {(["visits", "contacts"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={metric === m} className={cn("min-h-9 rounded-full px-3", metric === m ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground")} onClick={() => setMetric(m)}>{m === "visits" ? "Visits" : "New contacts"}</button>
              ))}
            </div>
            <button type="button" className="min-h-9 rounded-full border px-3 text-sm" onClick={() => setPivot(!pivot)}>{pivot ? "Rows: projects" : "Rows: states"} ⇄</button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm tabular-nums">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b">
                <th className="px-2 py-2 text-left font-medium">{pivot ? "Project" : "State"}</th>
                {cols.map((c) => <th key={c} className="px-2 py-2 text-right font-medium">{label(c, pivot)}</th>)}
                <th className="px-2 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r} className="border-b last:border-0">
                  <th className="px-2 py-1.5 text-left font-medium text-foreground">{label(r, !pivot)}</th>
                  {cols.map((c) => {
                    const st = pivot ? c : r;
                    const pr = pivot ? r : c;
                    const active = st === state && pr === project;
                    return (
                      <td key={c} className="px-1 py-1 text-right">
                        <button type="button" title="Use as filters" className={cn("min-h-8 w-full rounded-lg px-2 text-right hover:bg-muted", active && "bg-accent font-semibold")} onClick={() => pick(r, c)}>{cell(r, c)}</button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right font-semibold">{pivot ? total(metric, "All", r) : total(metric, r, "All")}</td>
                </tr>
              ))}
              <tr className="border-t-2">
                <th className="px-2 py-1.5 text-left font-semibold">Total</th>
                {cols.map((c) => <td key={c} className="px-2 py-1.5 text-right font-semibold">{pivot ? total(metric, c, "All") : total(metric, "All", c)}</td>)}
                <td className="px-2 py-1.5 text-right font-semibold">{total(metric, "All", "All")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Tap a number to set the Project and State filters.</p>
      </section>
    </div>
  );
}

function Card({ title, value, hint, href, link }: { title: string; value: number; hint: string; href: string; link: string }) {
  return (
    <div className="panel rounded-3xl p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="font-heading text-4xl font-semibold text-foreground tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <Link href={href} className="mt-2 inline-flex min-h-10 items-center text-sm text-primary">{link}</Link>
    </div>
  );
}

/** "Chanukah 5787" before "Summer 5786": by the year in the name, newest first. */
function newestFirst(a: string, b: string) {
  const year = (name: string) => Number(name.match(/(\d{4})\s*$/)?.[1] ?? 0);
  return year(b) - year(a) || a.localeCompare(b);
}
