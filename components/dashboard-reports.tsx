"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { FOCUS_STATES, reactionMeta, statusMeta } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { formatMedium } from "@/lib/format";
import type { AppData } from "@/lib/types";

const STATES = FOCUS_STATES.filter((item) => item.code !== "Unsorted");

/** Dashboard Reports table: people visited in a project (and state for admins). */
export function DashboardReports({ data }: { data: AppData }) {
  const admin = data.viewer.role === "admin" && !data.viewer.preview;
  const bochur = data.viewer.role === "bochur";
  const projects = data.projects;
  const lockedProjectId = bochur ? (data.viewer.projectId ?? "ALL") : null;
  const [projectId, setProjectId] = useState(lockedProjectId ?? projects[0]?.id ?? "ALL");
  const [state, setState] = useState("ALL");
  const activeProjectId = lockedProjectId ?? projectId;

  const rows = useMemo(() => {
    const houseById = new Map(data.households.map((h) => [h.id, h]));
    return data.visits
      .filter((visit) => {
        const house = houseById.get(visit.householdId);
        if (!house) return false;
        if (activeProjectId !== "ALL") {
          const projectName = projects.find((p) => p.id === activeProjectId)?.name;
          const ok =
            house.projectId === activeProjectId ||
            house.contactVisits.some(
              (cv) =>
                cv.id === visit.id &&
                projectName &&
                cv.visited.trim().toLowerCase() === projectName.trim().toLowerCase(),
            );
          if (!ok && house.projectId !== activeProjectId) return false;
        }
        if (admin && state !== "ALL") {
          const code = STATES.find((s) => s.code === state || s.name === state)?.code ?? state;
          if ((house.state || "").toUpperCase() !== code && house.state !== state) {
            const map: Record<string, string> = { Maine: "ME", "New Hampshire": "NH", Wisconsin: "WI", ME: "ME", NH: "NH", WI: "WI" };
            if ((map[house.state] ?? house.state) !== code) return false;
          }
        }
        return true;
      })
      .map((visit) => {
        const house = houseById.get(visit.householdId)!;
        const contact = house.contactVisits.find((cv) => cv.id === visit.id);
        return {
          ...visit,
          city: house.city,
          state: house.state,
          activities: contact?.activities ?? [],
        };
      })
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }, [activeProjectId, admin, data.households, data.visits, projects, state]);

  function download() {
    const csv = toCsv(
      ["Name", "City", "State", "Date", "Visitor", "Status", "Reaction", "Activities", "Details"],
      rows.map((row) => [
        row.householdName,
        row.city,
        row.state,
        row.visitDate,
        row.visitorName,
        row.status ?? "",
        row.reaction ?? "",
        row.activities.join("; "),
        row.details,
      ]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cora-dashboard-reports.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel rounded-3xl p-4" aria-label="Reports">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">
            {bochur
              ? (projects.find((p) => p.id === activeProjectId)?.name
                  ? `People visited in ${projects.find((p) => p.id === activeProjectId)!.name}.`
                  : "People visited in your project.")
              : "People visited in the selected project."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!bochur ? (
            <label className="text-xs text-muted-foreground">
              Project
              <select className="ml-1 h-9 rounded-lg border bg-background px-2 text-sm text-foreground" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="ALL">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {admin ? (
            <label className="text-xs text-muted-foreground">
              State
              <select className="ml-1 h-9 rounded-lg border bg-background px-2 text-sm text-foreground" value={state} onChange={(e) => setState(e.target.value)}>
                <option value="ALL">All states</option>
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs" onClick={download}>
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>
      {rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b">
                {["Name", "City / State", "Date", "Visitor", "Status", "Reaction", "Activities"].map((label) => (
                  <th key={label} className="px-2 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium text-foreground">{row.householdName}</td>
                  <td className="px-2 py-2 text-muted-foreground">{[row.city, row.state].filter(Boolean).join(", ")}</td>
                  <td className="px-2 py-2 tabular-nums">{formatMedium(row.visitDate)}</td>
                  <td className="px-2 py-2">{row.visitorName}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${statusMeta(row.status).className}`}>{statusMeta(row.status).label}</span></td>
                  <td className="px-2 py-2">{reactionMeta(row.reaction)?.label ?? "—"}</td>
                  <td className="px-2 py-2 text-muted-foreground">{row.activities.length ? row.activities.join(" · ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 100 ? <p className="mt-2 text-xs text-muted-foreground">Showing 100 of {rows.length}. Download CSV for all.</p> : null}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No visits match these filters.</p>
      )}
    </section>
  );
}
