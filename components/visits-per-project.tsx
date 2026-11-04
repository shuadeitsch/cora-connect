"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppData } from "@/lib/types";

const KEY = "cora.dashboard.visitsProject";

/** Completed contact visits per project. Uses the contacts this viewer can see, so role scoping comes from the data. */
export function VisitsPerProject({ data }: { data: AppData }) {
  return <PerProjectCard data={data} kind="visits" />;
}

/** Contacts whose project field is the chosen project; All = every contact this viewer can see. */
export function ContactsPerProject({ data }: { data: AppData }) {
  return <PerProjectCard data={data} kind="contacts" />;
}

function PerProjectCard({ data, kind }: { data: AppData; kind: "visits" | "contacts" }) {
  const key = kind === "visits" ? KEY : "cora.dashboard.contactsProject";
  const projects = useMemo(() => data.projects.map((project) => project.name).filter((name) => name.trim()).sort(newestFirst), [data.projects]);
  const [choice, setChoice] = useState("All");
  useEffect(() => {
    const saved = window.localStorage.getItem(key);
    if (saved && (saved === "All" || projects.includes(saved))) setChoice(saved);
  }, [projects, key]);
  const counts = useMemo(() => {
    const known = new Map(projects.map((name) => [name.trim().toLowerCase(), name]));
    const map = new Map<string, number>();
    let all = 0;
    if (kind === "contacts") {
      const byId = new Map(data.projects.map((project) => [project.id, project.name]));
      for (const household of data.households) {
        all += 1;
        const name = household.projectId ? byId.get(household.projectId) : undefined;
        if (name) map.set(name, (map.get(name) ?? 0) + 1);
      }
      return { all, map };
    }
    for (const household of data.households) {
      for (const visit of household.contactVisits) {
        if (visit.status !== "completed") continue;
        const name = known.get(visit.visited.trim().toLowerCase());
        if (!name) continue;
        all += 1;
        map.set(name, (map.get(name) ?? 0) + 1);
      }
    }
    return { all, map };
  }, [data.households, data.projects, projects, kind]);
  const value = choice === "All" ? counts.all : counts.map.get(choice) ?? 0;

  return (
    <div className="panel rounded-3xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{kind === "visits" ? "Visits per project" : "New contacts per project"}</p>
        <select
          aria-label="Project"
          className="h-9 min-w-0 max-w-[12rem] rounded-lg border bg-background px-2 text-sm text-foreground"
          value={choice}
          onChange={(event) => { setChoice(event.target.value); window.localStorage.setItem(key, event.target.value); }}
        >
          <option value="All">All</option>
          {projects.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <p className="font-heading text-4xl font-semibold text-foreground tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-muted-foreground">{kind === "contacts" ? (choice === "All" ? "All contacts" : `Contacts in ${choice}`) : choice === "All" ? "Completed visits, all projects, all time" : `Completed visits for ${choice}`}</p>
      <Link href={kind === "visits" ? "/reports" : "/households"} className="mt-2 inline-flex min-h-10 items-center text-sm text-primary">{kind === "visits" ? "View report" : "View contacts"}</Link>
    </div>
  );
}

/** "Chanukah 5787" before "Summer 5786": by the year in the name, newest first. */
function newestFirst(a: string, b: string) {
  const year = (name: string) => Number(name.match(/(\d{4})\s*$/)?.[1] ?? 0);
  return year(b) - year(a) || a.localeCompare(b);
}
