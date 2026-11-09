"use client";

import { useMemo, useState } from "react";
import { Greeting } from "@/components/greeting";
import { ActivityTotals } from "@/components/activity-totals";
import { DashboardReports } from "@/components/dashboard-reports";
import { FeedbackCard } from "@/components/feedback-card";
import { FOCUS_STATES } from "@/lib/constants";
import type { AppData } from "@/lib/types";

const STATES = FOCUS_STATES.filter((item) => item.code !== "Unsorted");

/**
 * Dashboard (1.8.24): shared Project (+ State for admin) filter bar drives every box.
 * All roles: Reports + Visit activities. Admin also: Feedback + Households by state.
 */
export function DashboardHome({ data }: { data: AppData }) {
  const { viewer } = data;
  const admin = viewer.role === "admin" && !viewer.preview;
  const bochur = viewer.role === "bochur";
  const lockedProjectId = bochur ? (viewer.projectId ?? "ALL") : null;
  const [projectId, setProjectId] = useState(lockedProjectId ?? "ALL");
  const [state, setState] = useState("ALL");
  const activeProjectId = lockedProjectId ?? projectId;

  const filteredHouseholds = useMemo(() => {
    return data.households.filter((house) => {
      if (activeProjectId !== "ALL" && house.projectId && house.projectId !== activeProjectId) {
        // Keep households with no projectId if matching via visits; for state card count by project on household
        if (house.projectId !== activeProjectId) return false;
      }
      if (activeProjectId !== "ALL" && !house.projectId) return false;
      if (admin && state !== "ALL") {
        const map: Record<string, string> = { Maine: "ME", "New Hampshire": "NH", Wisconsin: "WI", ME: "ME", NH: "NH", WI: "WI" };
        const code = STATES.find((s) => s.code === state)?.code ?? state;
        if ((map[house.state] ?? house.state) !== code && (house.state || "").toUpperCase() !== code) return false;
      }
      return true;
    });
  }, [activeProjectId, admin, data.households, state]);

  const stateCounts = new Map<string, number>();
  for (const household of filteredHouseholds) {
    const key = household.state || "—";
    stateCounts.set(key, (stateCounts.get(key) ?? 0) + 1);
  }
  const states = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxState = Math.max(...states.map(([, count]) => count), 1);

  const filters = { projectId: activeProjectId, state: admin ? state : "ALL" };

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <Greeting name={viewer.name} />

      <div className="flex flex-wrap items-center gap-2" aria-label="Dashboard filters">
        {bochur ? (
          <p className="text-sm text-muted-foreground">
            Project: <span className="font-medium text-foreground">{data.projects.find((p) => p.id === activeProjectId)?.name ?? "Your project"}</span>
          </p>
        ) : (
          <label className="text-xs text-muted-foreground">
            Project
            <select
              className="ml-1 h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="ALL">All projects</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
        {admin ? (
          <label className="text-xs text-muted-foreground">
            State
            <select
              className="ml-1 h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="ALL">All states</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <DashboardReports data={data} projectId={filters.projectId} state={filters.state} />
      <ActivityTotals data={data} projectId={filters.projectId} state={filters.state} />
      {admin ? <FeedbackCard /> : null}
      {admin ? (
        <section className="panel rounded-3xl p-4" aria-label="Households by state">
          <h2 className="font-heading text-xl font-semibold text-foreground">Households by state</h2>
          {states.length ? (
            <ul className="mt-4 space-y-2.5">
              {states.map(([label, count]) => (
                <li key={label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-foreground">{label}</span>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-chart-2" style={{ width: `${(count / maxState) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No households match these filters.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
