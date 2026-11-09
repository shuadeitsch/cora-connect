"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { reactionMeta, statusMeta } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { formatMedium } from "@/lib/format";
import type { AppData, Reaction, VisitStatus } from "@/lib/types";

type SortMode = "recent" | "name";

type ReportRow = {
  id: string;
  householdId: string;
  householdName: string;
  city: string;
  state: string;
  visitDate: string;
  visitorName: string;
  status: VisitStatus | null;
  reaction: Reaction | null;
  activities: string[];
  visitedProjects: string[];
  details: string;
};

function stateCode(raw: string) {
  const map: Record<string, string> = { Maine: "ME", "New Hampshire": "NH", Wisconsin: "WI", ME: "ME", NH: "NH", WI: "WI" };
  return map[raw] ?? raw.toUpperCase();
}

/** Dashboard Reports box. Shared wording for every role; filters come from the Dashboard bar. */
export function DashboardReports({
  data,
  projectId = "ALL",
  state = "ALL",
}: {
  data: AppData;
  projectId?: string;
  state?: string;
}) {
  const projects = data.projects;
  const [sort, setSort] = useState<SortMode>("recent");

  const visitedFor = useMemo(() => {
    const names = new Map(projects.map((project) => [project.name.trim().toLowerCase(), project.name]));
    const map = new Map<string, string[]>();
    for (const household of data.households) {
      const list = [
        ...new Set(
          household.contactVisits
            .filter((visit) => visit.status === "completed")
            .map((visit) => names.get(visit.visited.trim().toLowerCase()))
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      list.sort((a, b) => b.localeCompare(a));
      map.set(household.id, list);
    }
    return map;
  }, [data.households, projects]);

  const rows = useMemo(() => {
    const houseById = new Map(data.households.map((h) => [h.id, h]));
    const filtered = data.visits
      .filter((visit) => {
        const house = houseById.get(visit.householdId);
        if (!house) return false;
        if (projectId !== "ALL") {
          const projectName = projects.find((p) => p.id === projectId)?.name;
          const ok =
            house.projectId === projectId ||
            house.contactVisits.some(
              (cv) =>
                cv.id === visit.id &&
                projectName &&
                cv.visited.trim().toLowerCase() === projectName.trim().toLowerCase(),
            );
          if (!ok && house.projectId !== projectId) return false;
        }
        if (state !== "ALL") {
          if (stateCode(house.state || "") !== stateCode(state)) return false;
        }
        return true;
      })
      .map((visit): ReportRow => {
        const house = houseById.get(visit.householdId)!;
        const contact = house.contactVisits.find((cv) => cv.id === visit.id);
        return {
          id: visit.id,
          householdId: house.id,
          householdName: visit.householdName,
          city: house.city,
          state: house.state,
          visitDate: visit.visitDate,
          visitorName: visit.visitorName,
          status: visit.status ?? null,
          reaction: visit.reaction ?? null,
          activities: contact?.activities ?? [],
          visitedProjects: visitedFor.get(house.id) ?? [],
          details: visit.details ?? "",
        };
      });

    const latest = new Map<string, ReportRow>();
    for (const row of filtered.sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.id.localeCompare(a.id))) {
      if (!latest.has(row.householdId)) latest.set(row.householdId, row);
    }
    const people = [...latest.values()];
    if (sort === "name") {
      people.sort((a, b) => a.householdName.localeCompare(b.householdName) || b.visitDate.localeCompare(a.visitDate));
    } else {
      people.sort((a, b) => b.visitDate.localeCompare(a.visitDate) || a.householdName.localeCompare(b.householdName));
    }
    return people;
  }, [data.households, data.visits, projectId, projects, sort, state, visitedFor]);

  function download() {
    const csv = toCsv(
      ["Name", "City", "State", "Date", "Visitor", "Status", "Reaction", "Visited", "Activities", "Details"],
      rows.map((row) => [
        row.householdName,
        row.city,
        row.state,
        row.visitDate,
        row.visitorName,
        row.status ?? "",
        row.reaction ?? "",
        row.visitedProjects.join("; "),
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
            People visited — one row per person, most recent first.
            {rows.length ? ` · ${rows.length} ${rows.length === 1 ? "person" : "people"}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">
            Sort
            <select className="ml-1 h-9 rounded-lg border bg-background px-2 text-sm text-foreground" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="recent">Recently visited</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          <button type="button" className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs" onClick={download}>
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>
      {rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b">
                {["Name", "City / State", "Date", "Visitor", "Status", "Reaction", "Visited", "Activities"].map((label) => (
                  <th key={label} className="px-2 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((row) => (
                <tr key={row.householdId} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium text-foreground">{row.householdName}</td>
                  <td className="px-2 py-2 text-muted-foreground">{[row.city, row.state].filter(Boolean).join(", ")}</td>
                  <td className="px-2 py-2 tabular-nums">{formatMedium(row.visitDate)}</td>
                  <td className="px-2 py-2">{row.visitorName}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${statusMeta(row.status).className}`}>{statusMeta(row.status).label}</span></td>
                  <td className="px-2 py-2">{reactionMeta(row.reaction)?.label ?? "—"}</td>
                  <td className="px-2 py-2">
                    {row.visitedProjects.length ? (
                      <span className="flex flex-wrap gap-1">
                        {row.visitedProjects.map((name) => (
                          <span key={name} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">{name}</span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
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
