"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { OutreachView } from "@/components/preplanner-view";
import { PreplannerTasksPanel } from "@/components/preplanner-tasks-panel";
import { FOCUS_STATES, stateLabel } from "@/lib/constants";
import type { PreplannerTask } from "@/lib/preplanner-tasks";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE_KEY = "cora-preplanner-state";

/** Pre-planner: pick a state (admins choose; others are locked to their own), then Outreach or Tasks. */
export function PreplannerHome({ data, tasks }: { data: AppData; tasks: PreplannerTask[] }) {
  const isAdmin = data.viewer.role === "admin";
  const [section, setSection] = useState<"outreach" | "tasks">("outreach");
  const [stateFilter, setStateFilter] = useState("");
  const own = useMemo(() => [...new Set(data.viewer.territory.map((row) => stateLabel(row.state)).filter(Boolean))], [data.viewer.territory]);
  const stateOptions = useMemo(() => {
    const set = new Set<string>(FOCUS_STATES.filter((item) => item.code !== "Unsorted").map((item) => item.name));
    for (const house of data.households) { const st = stateLabel(house.state || ""); if (st) set.add(st); }
    for (const task of tasks) { const st = stateLabel(task.state || ""); if (st) set.add(st); }
    return [...set].sort();
  }, [data.households, tasks]);
  useEffect(() => {
    try { setStateFilter(window.localStorage.getItem(STATE_KEY) ?? ""); } catch { /* ignore */ }
  }, []);
  const activeState = isAdmin && stateOptions.includes(stateFilter) ? stateFilter : "";
  function chooseState(value: string) {
    setStateFilter(value);
    try { window.localStorage.setItem(STATE_KEY, value); } catch { /* ignore */ }
  }
  const tab = (id: "outreach" | "tasks", label: string) => (
    <button type="button" role="tab" aria-selected={section === id} className={cn("h-11 flex-1 rounded-full px-5 text-sm font-medium sm:flex-none", section === id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")} onClick={() => setSection(id)}>{label}</button>
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Pre-planner" crumb="Pre-planner" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {isAdmin ? (
          <label className="flex w-full items-center gap-2 text-sm sm:w-auto">
            <span className="text-muted-foreground">State</span>
            <select className="h-11 min-w-0 flex-1 rounded-xl border bg-card px-3 text-sm sm:flex-none" value={activeState} onChange={(event) => chooseState(event.target.value)} aria-label="State">
              <option value="">All states</option>
              {stateOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">State: <span className="font-medium text-foreground">{own.join(", ") || "Your state"}</span></p>
        )}
      </div>
      <div className="mb-4 flex w-full gap-1 rounded-full border bg-card p-1 sm:inline-flex sm:w-auto" role="tablist" aria-label="Pre-planner sections">
        {tab("outreach", "Outreach")}
        {tab("tasks", "Tasks")}
      </div>
      {section === "outreach" ? (
        <OutreachView data={data} activeState={activeState} />
      ) : (
        <PreplannerTasksPanel tasks={tasks} activeState={activeState} defaultState={own[0] ?? ""} stateChoices={stateOptions} isAdmin={isAdmin} />
      )}
    </div>
  );
}
