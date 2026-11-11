"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  Download,
  MapPin,
  Sigma,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { reactionMeta, sameState, statusMeta, VISIT_ACTIVITIES } from "@/lib/constants";
import { isNewContact } from "@/lib/new-contacts";
import { countRemovedTagged, isTaggedContact } from "@/lib/contact-tags";
import { downloadCsvFile } from "@/lib/download-csv";
import { formatMedium } from "@/lib/format";
import { activityCountsFor, visitCoverage } from "@/lib/visit-activities";
import type { AppData, Reaction, VisitStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActivityIcon } from "@/components/activity-icon";
import { PAGE_SIZE_OPTIONS, Pager } from "@/components/pager";

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

const TILE_ICON: Record<string, typeof Users> = {
  Visits: Users,
  "New contacts found": UserPlus,
  "Removed: not Jewish / not existent": UserMinus,
  Total: Sigma,
};


const INCLUDE_DEFERRED_KEY = "cora-visits-include-deferred";
const INCLUDE_REMOVED_KEY = "cora-visits-include-removed";

function TileGlyph({ label }: { label: string }) {
  const activity = <ActivityIcon label={label} className="size-3.5" />;
  if (label === "Tefillin" || label === "Menorah/package" || label === "Mezuzah" || label === "Challah" || label === "Write-in") {
    return activity;
  }
  const Lucide = TILE_ICON[label] ?? BookOpen;
  return <Lucide className="size-3.5 shrink-0" aria-hidden />;
}


function StatTile({
  label,
  count,
  tone = "default",
  detail,
  progress,
  href,
  footer,
}: {
  label: string;
  count: number;
  tone?: "default" | "accent" | "muted";
  detail?: string;
  progress?: number;
  href?: string;
  footer?: ReactNode;
}) {
  const body = (
    <div
      className={cn(
        "flex min-h-[5.5rem] h-full flex-col justify-between rounded-2xl border p-3 sm:p-3.5",
        tone === "accent" && "border-primary/30 bg-primary/5",
        tone === "muted" && "bg-muted/40",
        tone === "default" && "bg-card",
        detail && "sm:col-span-2 lg:col-span-2",
        href && "transition hover:ring-2 hover:ring-primary/40",
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <TileGlyph label={label} />
        <span className="truncate text-[11px] font-medium tracking-wide uppercase">{label}</span>
      </div>
      {detail ? (
        <div className="mt-1 space-y-1.5">
          <p className="font-heading text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{detail}</p>
          {typeof progress === "number" ? (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  aria-hidden
                />
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums">{progress}% of contacts</p>
            </>
          ) : null}
          {footer}
        </div>
      ) : (
        <div className="mt-1 space-y-1">
          <p className="font-heading text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">{count}</p>
          {footer}
        </div>
      )}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className={cn("block", detail && "sm:col-span-2 lg:col-span-2")} aria-label={`${label}: ${detail ?? count}`}>
        {body}
      </Link>
    );
  }
  return body;
}

/** One Visits box: activity tiles (always, including 0) + people list. Filters from the Dashboard bar. */
export function DashboardReports({
  data,
  projectId,
  state = "ALL",
}: {
  data: AppData;
  projectId: string;
  state?: string;
}) {
  const projects = data.projects;
  const allProjects = !projectId || projectId === "ALL";
  const projectName = allProjects ? undefined : projects.find((p) => p.id === projectId)?.name;
  const [sort, setSort] = useState<SortMode>("recent");
  const [includeDeferred, setIncludeDeferred] = useState(false);
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const viewer = data.viewer;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INCLUDE_DEFERRED_KEY);
      if (raw === "1" || raw === "true") setIncludeDeferred(true);
      const removedKey = `${INCLUDE_REMOVED_KEY}:${viewer.id}`;
      const removedRaw = window.localStorage.getItem(removedKey) ?? window.localStorage.getItem(INCLUDE_REMOVED_KEY);
      if (removedRaw === "1" || removedRaw === "true") setIncludeRemoved(true);
    } catch {
      /* ignore */
    }
  }, [viewer.id]);

  function toggleIncludeDeferred(next: boolean) {
    setIncludeDeferred(next);
    try {
      window.localStorage.setItem(INCLUDE_DEFERRED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function toggleIncludeRemoved(next: boolean) {
    setIncludeRemoved(next);
    try {
      window.localStorage.setItem(`${INCLUDE_REMOVED_KEY}:${viewer.id}`, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const contactVisits = useMemo(
    () =>
      data.households.flatMap((h) =>
        h.contactVisits.map((v) => ({
          id: v.id,
          orgId: data.viewer.orgId,
          householdId: h.id,
          visited: v.visited,
          visitedBy: v.visitedBy ?? null,
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
      { state, projectId, projectName },
    );
  }, [contactVisits, householdsForCounts, projectId, projectName, state, viewer]);

  const visitedFor = useMemo(() => {
    const names = new Map(projects.map((project) => [project.name.trim().toLowerCase(), project.name]));
    const map = new Map<string, string[]>();
    for (const household of data.households) {
      const list = [
        ...new Set(
          household.contactVisits
            .filter((visit) => !visit.status || visit.status === "completed" || visit.status === "deferred")
            .map((visit) => names.get(visit.visited.trim().toLowerCase()))
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      list.sort((a, b) => b.localeCompare(a));
      map.set(household.id, list);
    }
    return map;
  }, [data.households, projects]);

  const coverage = useMemo(
    () =>
      visitCoverage(data.households, {
        state,
        projectId,
        projectName,
        includeDeferred,
        includeRemoved,
      }),
    [data.households, includeDeferred, includeRemoved, projectId, projectName, state],
  );

  const newContactsFound = useMemo(() => {
    const pname = projectName?.trim().toLowerCase() ?? "";
    return data.households.filter((house) => {
      if (house.deletedAt || house.deletedByShliachAt) return false;
      if (!isNewContact(house)) return false;
      if (isTaggedContact(house.tags ?? [])) return false;
      if (state !== "ALL" && !sameState(house.state, state)) return false;
      if (allProjects) return true;
      if (house.projectId === projectId) return true;
      // Visits tagged to this project also count the contact as found during it when project_id is blank.
      if (!house.projectId && pname) {
        return house.contactVisits.some((cv) => cv.visited.trim().toLowerCase() === pname || cv.projectId === projectId);
      }
      return false;
    }).length;
  }, [allProjects, data.households, projectId, projectName, state]);

  const removedTagged = useMemo(
    () => countRemovedTagged(data.households, state),
    [data.households, state],
  );

  const rows = useMemo(() => {
    // Prefer contact_visits — the visits log can be empty/soft-deleted while history still has rows.
    // List follows Include deferred: completed only by default; + deferred when checked.
    // Removed/tagged contacts never appear.
    const nameById = new Map(data.members.filter((m) => m.kind === "member").map((m) => [m.id, m.name]));
    const pname = projectName?.trim().toLowerCase() ?? "";
    const filtered: ReportRow[] = [];
    for (const house of data.households) {
      if (house.deletedAt || house.deletedByShliachAt) continue;
      if (state !== "ALL" && stateCode(house.state || "") !== stateCode(state)) continue;
      if (isTaggedContact(house.tags ?? [])) continue;
      for (const cv of house.contactVisits) {
        const st = cv.status ?? "completed";
        if (st === "completed") {
          /* always */
        } else if (includeDeferred && st === "deferred") {
          /* when Include deferred is on */
        } else {
          continue;
        }
        const onProject =
          allProjects ||
          cv.projectId === projectId ||
          house.projectId === projectId ||
          Boolean(pname && cv.visited.trim().toLowerCase() === pname);
        if (!onProject) continue;
        const visitDate = cv.visitDate || cv.createdAt.slice(0, 10);
        if (!visitDate) continue;
        filtered.push({
          id: cv.id,
          householdId: house.id,
          householdName: house.name,
          city: house.city,
          state: house.state,
          visitDate,
          visitorName: (cv.visitedBy && cv.visitedBy.trim()) || (cv.createdBy && nameById.get(cv.createdBy)) || "—",
          status: (cv.status === "deferred" ? "deferred" : "completed") as VisitStatus,
          reaction: (cv.reaction as Reaction | null) ?? null,
          activities: cv.activities ?? [],
          visitedProjects: visitedFor.get(house.id) ?? [],
          details: cv.notes ?? "",
        });
      }
    }

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
  }, [allProjects, data.households, data.members, includeDeferred, projectId, projectName, sort, state, visitedFor]);

  async function download() {
    if (!viewer.canExport) return;
    const result = await downloadCsvFile({
      filename: "cora-dashboard-visits.csv",
      headers: ["Name", "City", "State", "Date", "Visited by", "Status", "Reaction", "Visited", "Activities", "Details"],
      rows: rows.map((row) => [
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
    });
    if (!result.ok) window.alert(result.error);
  }

  const foundHref = allProjects
    ? `/households?found=1${state && state !== "ALL" ? `&state=${encodeURIComponent(state)}` : ""}`
    : `/households?found=1&project=${encodeURIComponent(projectId)}${state && state !== "ALL" ? `&state=${encodeURIComponent(state)}` : ""}`;

  const denom = coverage.denominator;
  const removedCount = coverage.removed;
  const denomHint =
    !includeRemoved && removedCount > 0 ? (
      <p className="text-[10px] leading-snug text-muted-foreground">
        Excluding {removedCount} which {removedCount === 1 ? "was" : "were"} removed (not Jewish or doesn&apos;t exist)
      </p>
    ) : null;

  const tiles: {
    label: string;
    count: number;
    tone?: "default" | "accent" | "muted";
    detail?: string;
    progress?: number;
    href?: string;
    footer?: ReactNode;
  }[] = [
    {
      label: "Visits",
      count: coverage.visited,
      tone: "accent",
      detail: `${coverage.visited} of ${denom} contacts`,
      progress: coverage.percent,
      footer: (
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={includeDeferred}
              onChange={(e) => toggleIncludeDeferred(e.target.checked)}
            />
            <span>Include deferred</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={includeRemoved}
              onChange={(e) => toggleIncludeRemoved(e.target.checked)}
            />
            <span>Include removed</span>
          </label>
          {denomHint}
        </div>
      ),
    },
    {
      label: "New contacts found",
      count: newContactsFound,
      href: foundHref,
    },
    {
      label: "Removed: not Jewish / not existent",
      count: removedTagged,
      href: `/households?list=tagged${state && state !== "ALL" ? `&state=${encodeURIComponent(state)}` : ""}`,
    },
    ...VISIT_ACTIVITIES.map((label) => ({
      label,
      count: activityRows.find((r) => r.label === label)?.count ?? 0,
    })),
    { label: "Write-in", count: activityRows.find((r) => r.label === "Write-in")?.count ?? 0 },
    { label: "Total", count: activityRows.find((r) => r.label === "Total")?.count ?? 0, tone: "muted" as const },
  ];

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="panel space-y-4 rounded-3xl p-4" aria-label="Visits" data-tour="visits">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground">Visits</h2>
          <p className="text-sm text-muted-foreground">
            {allProjects ? "All projects: " : projectName ? `${projectName}: ` : ""}
            {coverage.visited} of {denom} contacts visited
            {denom ? ` (${coverage.percent}%)` : ""}
            {includeDeferred ? " (completed + deferred)" : " (completed only)"}
            {includeRemoved ? " (including removed)" : ""}.
            {!includeRemoved && coverage.removed
              ? ` Excluding ${coverage.removed} which ${coverage.removed === 1 ? "was" : "were"} removed (not Jewish or doesn't exist).`
              : ""}
            {" "}People list matches the checkbox (removed contacts never listed).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">
            Sort
            <select
              className="ml-1 h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortMode);
                setPage(1);
              }}
            >
              <option value="recent">Recently visited</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            Showing
            <select
              className="mx-1 h-9 rounded-lg border bg-background px-1 text-sm text-foreground"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            of {rows.length}
          </p>
          {viewer.canExport ? (
          <button type="button" className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs" onClick={() => void download()}>
            <Download className="size-3.5" /> CSV
          </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-9">
        {tiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} count={tile.count} tone={tile.tone} detail={tile.detail} progress={tile.progress} href={tile.href} footer={tile.footer} />
        ))}
      </div>

      {rows.length ? (
        <div className="space-y-2" data-tour="visits-people">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Status colors</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" aria-hidden /> Completed</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" aria-hidden /> Deferred</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b bg-muted/30">
                {["Name", "City / State", "Date", "Visited by", "Status", "Reaction", "Visited", "Activities"].map((label) => (
                  <th key={label} className="px-2 py-2 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={row.householdId}
                  className={cn(
                    "border-b last:border-0",
                    row.status === "deferred" ? "bg-amber-50/80 dark:bg-amber-950/30" : "bg-emerald-50/50 dark:bg-emerald-950/20",
                  )}
                >
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
                  <td className="px-2 py-2 text-muted-foreground">
                    {row.activities.length ? (
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        {row.activities.map((a) => (
                          <span key={a} className="inline-flex items-center gap-1">
                            <ActivityIcon label={a} className="size-3.5" />
                            {a}
                          </span>
                        ))}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={safePage} pages={pages} onPage={setPage} />
        </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 py-8 text-center text-sm text-muted-foreground" data-tour="visits-people">
          <MapPin className="mx-auto size-4 opacity-50" />
          <span className="w-full">No visits match these filters.</span>
        </p>
      )}
    </section>
  );
}
