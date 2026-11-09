"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Download,
  Flame,
  HandHeart,
  MapPin,
  Package,
  PenLine,
  ScrollText,
  Sigma,
  Users,
} from "lucide-react";
import { reactionMeta, statusMeta, VISIT_ACTIVITIES } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { formatMedium } from "@/lib/format";
import { activityCountsFor } from "@/lib/visit-activities";
import type { AppData, Reaction, VisitStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

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

const ACTIVITY_ICON: Record<string, typeof Users> = {
  Visits: Users,
  Tefillin: HandHeart,
  "Menorah/package": Flame,
  Mezuzah: ScrollText,
  Challah: Package,
  "Write-in": PenLine,
  Total: Sigma,
};

function StatTile({
  label,
  count,
  tone = "default",
}: {
  label: string;
  count: number;
  tone?: "default" | "accent" | "muted";
}) {
  const Icon = ACTIVITY_ICON[label] ?? BookOpen;
  return (
    <div
      className={cn(
        "flex min-h-[5.5rem] flex-col justify-between rounded-2xl border p-3 sm:p-3.5",
        tone === "accent" && "border-primary/30 bg-primary/5",
        tone === "muted" && "bg-muted/40",
        tone === "default" && "bg-card",
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate text-[11px] font-medium tracking-wide uppercase">{label}</span>
      </div>
      <p className="font-heading text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">{count}</p>
    </div>
  );
}

/** One Visits box: activity tiles (always, including 0) + people list. Filters from the Dashboard bar. */
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
  const viewer = data.viewer;

  const contactVisits = useMemo(
    () =>
      data.households.flatMap((h) =>
        h.contactVisits.map((v) => ({
          id: v.id,
          orgId: data.viewer.orgId,
          householdId: h.id,
          visited: v.visited,
          reaction: v.reaction,
          notes: v.notes,
          visitDate: v.visitDate,
          status: v.status,
          arrived: "",
          createdBy: v.createdBy,
          createdAt: v.createdAt,
          importBatchId: null as string | null,
          activities: v.activities ?? [],
          projectId: v.projectId ?? null,
        })),
      ),
    [data.households, data.viewer.orgId],
  );

  const householdsForCounts = useMemo(
    () =>
      data.households.map((h) => ({
        id: h.id,
        orgId: data.viewer.orgId,
        name: h.name,
        street: h.street,
        city: h.city,
        state: h.state,
        zip: h.zip,
        country: h.country,
        lat: h.lat,
        lng: h.lng,
        notes: h.notes,
        projectId: h.projectId,
        scheduleCategoryId: h.scheduleCategoryId,
        categoryIds: h.categoryIds,
        tags: h.tags,
        customFields: h.customFields,
        sharedWithCora: h.sharedWithCora,
        ownerId: h.ownerId,
        visitReaction: h.visitReaction,
        possibleDuplicate: h.possibleDuplicate,
        duplicateOf: h.duplicateOf,
        createdAt: h.createdAt,
        importBatchId: h.importBatchId,
        deletedByShliachAt: h.deletedByShliachAt,
        deletedByShliachBy: h.deletedByShliachBy,
      })),
    [data.households, data.viewer.orgId],
  );

  const activityRows = useMemo(() => {
    return activityCountsFor(
      contactVisits,
      householdsForCounts as never,
      {
        id: viewer.id,
        orgId: viewer.orgId,
        name: viewer.name,
        email: viewer.email,
        passwordHash: "",
        role: viewer.role,
        status: viewer.status,
        expiresAt: viewer.expiresAt,
        canViewHistory: viewer.canViewHistory,
        canViewContact: viewer.canViewContact,
        canEdit: viewer.canEdit,
        assignedRouteIds: [],
        leaderId: viewer.leaderId,
        territory: viewer.territory,
        projectId: viewer.projectId,
      },
      { state, projectId },
    );
  }, [contactVisits, householdsForCounts, projectId, state, viewer]);

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

  const peopleCount = rows.length;

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
    link.download = "cora-dashboard-visits.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const tiles: { label: string; count: number; tone?: "default" | "accent" | "muted" }[] = [
    { label: "Visits", count: peopleCount, tone: "accent" },
    ...VISIT_ACTIVITIES.map((label) => ({
      label,
      count: activityRows.find((r) => r.label === label)?.count ?? 0,
    })),
    { label: "Write-in", count: activityRows.find((r) => r.label === "Write-in")?.count ?? 0 },
    { label: "Total", count: activityRows.find((r) => r.label === "Total")?.count ?? 0, tone: "muted" as const },
  ];

  return (
    <section className="panel space-y-4 rounded-3xl p-4" aria-label="Visits">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground">Visits</h2>
          <p className="text-sm text-muted-foreground">
            Activity totals and people visited — one row per person, most recent first.
            {peopleCount ? ` · ${peopleCount} ${peopleCount === 1 ? "person" : "people"}` : ""}
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {tiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} count={tile.count} tone={tile.tone} />
        ))}
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b bg-muted/30">
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
          {rows.length > 100 ? <p className="px-2 py-2 text-xs text-muted-foreground">Showing 100 of {rows.length}. Download CSV for all.</p> : null}
        </div>
      ) : (
        <p className="flex items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <MapPin className="mx-auto size-4 opacity-50" />
          <span className="w-full">No visits match these filters.</span>
        </p>
      )}
    </section>
  );
}
