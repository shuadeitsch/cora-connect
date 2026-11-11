"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, History, Pencil, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ScrollRegion } from "@/components/scroll-region";
import { VisitDialog, visitInputFrom } from "@/components/visit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { downloadCsvFile } from "@/lib/download-csv";
import { REACTIONS, reactionMeta, statusMeta } from "@/lib/constants";
import { formatMedium } from "@/lib/format";
import type { AppData, VisitView } from "@/lib/types";

export function ReportsView({ data, startNew, householdId }: { data: AppData; startNew: boolean; householdId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [reaction, setReaction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState(startNew);
  const [editing, setEditing] = useState<VisitView | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data.visits.filter((visit) => {
      if (q && !`${visit.householdName} ${visit.details} ${visit.visitorName}`.toLowerCase().includes(q)) return false;
      if (status && visit.status !== status) return false;
      if (reaction && visit.reaction !== reaction) return false;
      if (from && visit.visitDate < from) return false;
      if (to && visit.visitDate > to) return false;
      return true;
    });
    list.sort((a, b) => (sort === "asc" ? a.visitDate.localeCompare(b.visitDate) : b.visitDate.localeCompare(a.visitDate)));
    return list;
  }, [data.visits, query, status, reaction, from, to, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, pages);
  const slice = rows.slice((safe - 1) * pageSize, safe * pageSize);

  // Projects each contact was visited for: completed contact visits (deleted ones aren't loaded), by project name.
  const visitedFor = useMemo(() => {
    const names = new Map(data.projects.map((project) => [project.name.trim().toLowerCase(), project.name]));
    const map = new Map<string, string[]>();
    for (const household of data.households) {
      const list = [...new Set(household.contactVisits.filter((visit) => visit.status === "completed").map((visit) => names.get(visit.visited.trim().toLowerCase())).filter((name): name is string => Boolean(name)))];
      list.sort((a, b) => b.localeCompare(a));
      map.set(household.id, list);
    }
    return map;
  }, [data.households, data.projects]);

  async function download() {
    if (!data.viewer.canExport) return;
    const result = await downloadCsvFile({
      filename: "cora-visits.csv",
      headers: ["Household", "Date", "Status", "Reaction", "Details", "Visitor", "Visited", "Categories"],
      rows: rows.map((visit) => [visit.householdName, visit.visitDate, visit.status ?? "", visit.reaction ?? "", visit.details, visit.visitorName, (visitedFor.get(visit.householdId) ?? []).join("; "), visit.categoryNames.join("; ")]),
    });
    if (!result.ok) window.alert(result.error);
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Reports"
        crumb="Reports"
        action={data.viewer.canLogVisit ? <Button className="rounded-full" onClick={() => { setEditing(null); setOpen(true); }}>Log visit</Button> : null}
      />
      {!data.viewer.canViewHistory ? <p className="mb-3 text-sm text-mutedink">Visit notes and reactions are hidden for your access. Status is still listed.</p> : null}
      <div className="mb-3 flex flex-wrap gap-2">
        <Popover>
          <PopoverTrigger asChild><button type="button" className="h-8 rounded-full border bg-card px-3 text-xs">Filters</button></PopoverTrigger>
          <PopoverContent className="grid w-72 gap-2">
            <select className="h-9 rounded-lg border px-2 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">Any status</option>
              <option value="completed">Completed</option>
              <option value="deferred">Deferred</option>
            </select>
            <select className="h-9 rounded-lg border px-2 text-sm" value={reaction} onChange={(event) => { setReaction(event.target.value); setPage(1); }}>
              <option value="">Any reaction</option>
              {REACTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <label className="text-xs text-mutedink">From <input type="date" className="mt-1 h-9 w-full rounded-lg border px-2" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="text-xs text-mutedink">To <input type="date" className="mt-1 h-9 w-full rounded-lg border px-2" value={to} onChange={(event) => setTo(event.target.value)} /></label>
            <Button variant="outline" className="rounded-full" onClick={() => { setStatus(""); setReaction(""); setFrom(""); setTo(""); }}>Reset</Button>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild><button type="button" className="h-8 rounded-full border bg-card px-3 text-xs">Sort by</button></PopoverTrigger>
          <PopoverContent className="w-40 p-1">
            <button type="button" className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => setSort("desc")}>Descending</button>
            <button type="button" className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => setSort("asc")}>Ascending</button>
          </PopoverContent>
        </Popover>
        {data.viewer.canExport ? <button type="button" className="h-8 rounded-full border bg-card px-3 text-xs" onClick={() => void download()}><Download className="mr-1 inline size-3.5" /> Download</button> : null}
      </div>
      <div className="panel overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-mutedink" />
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search" className="w-56 pl-8" />
          </div>
          <p className="text-xs text-mutedink">Showing <select className="mx-1 rounded border px-1" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[10, 25, 50].map((size) => <option key={size}>{size}</option>)}</select> of {rows.length} entries</p>
        </div>
        <ScrollRegion className="hidden md:block">
          <table className="w-full text-left text-[12.5px]">
            <thead className="text-[11px] tracking-wide text-mutedink uppercase">
              <tr className="border-b">
                <th className="px-2 py-2 font-medium">Household</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Reaction</th>
                <th className="hidden px-2 py-2 font-medium xl:table-cell">Details</th>
                <th className="px-2 py-2 font-medium">Visited</th>
                <th className="hidden px-2 py-2 font-medium xl:table-cell">Categories</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {slice.map((visit) => {
                const meta = reactionMeta(visit.reaction);
                return (
                  <tr key={visit.id} className="border-b align-top last:border-0">
                    <td className="px-2 py-2 font-semibold text-foreground">{visit.householdName}<div className="text-[11px] font-normal text-mutedink" title={visit.visitorName}>{formatMedium(visit.visitDate)} · {visit.visitorName}</div></td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${statusMeta(visit.status).className}`}>{statusMeta(visit.status).label}</span></td>
                    <td className="px-2 py-2">{meta ? `${meta.emoji} ${meta.label}` : "—"}</td>
                    <td className="hidden max-w-xs px-2 py-2 text-foreground xl:table-cell">
                      {expanded === visit.id ? visit.details : visit.details.slice(0, 80)}
                      {visit.details.length > 80 ? <button type="button" className="ml-1 text-link" onClick={() => setExpanded(expanded === visit.id ? null : visit.id)}>{expanded === visit.id ? "less" : "more"}</button> : null}
                    </td>
                    <td className="px-2 py-2"><VisitedChips names={visitedFor.get(visit.householdId) ?? []} /></td>
                    <td className="hidden px-2 py-2 xl:table-cell">{visit.categoryNames.join(", ") || "—"}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        {data.viewer.canLogVisit ? <button type="button" aria-label="Edit visit" className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-primary" onClick={() => { setEditing(visit); setOpen(true); }}><Pencil className="size-3.5" /></button> : null}
                        <button type="button" aria-label="Household" className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-primary" onClick={() => router.push(`/households?focus=${visit.householdId}`)}><History className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollRegion>
        <div className="divide-y md:hidden">
          {slice.map((visit) => (
            <button key={visit.id} type="button" className="block w-full px-3 py-3 text-left" onClick={() => { setEditing(visit); setOpen(true); }}>
              <p className="font-semibold text-foreground">{visit.householdName}</p>
              <p className="text-xs text-mutedink">{formatMedium(visit.visitDate)} · {statusMeta(visit.status).label} · {reactionMeta(visit.reaction)?.label ?? "No reaction"}</p>
              <div className="mt-1"><VisitedChips names={visitedFor.get(visit.householdId) ?? []} /></div>
              {visit.details ? <p className="mt-1 text-sm">{visit.details}</p> : null}
            </button>
          ))}
        </div>
        {!slice.length ? <p className="px-4 py-10 text-center text-sm text-mutedink">No visits match.</p> : null}
        {pages > 1 ? (
          <div className="flex justify-end gap-1 px-3 py-3">
            {Array.from({ length: pages }, (_, index) => index + 1).slice(0, 8).map((n) => (
              <button key={n} type="button" className={n === safe ? "size-8 rounded-full bg-primary text-sm text-primary-foreground" : "size-8 rounded-full text-sm"} onClick={() => setPage(n)}>{n}</button>
            ))}
          </div>
        ) : null}
      </div>
      <VisitDialog
        open={open}
        onOpenChange={setOpen}
        households={data.households.map((household) => ({ id: household.id, name: household.name }))}
        initial={editing ? visitInputFrom(editing) : householdId ? { householdId, visitDate: "", status: "", reaction: "", details: "" } : undefined}
        canDelete={data.viewer.canManage}
      />
    </div>
  );
}

function VisitedChips({ names }: { names: string[] }) {
  if (!names.length) return <span className="text-mutedink">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {names.map((name) => <span key={name} className="rounded-full bg-muted px-1.5 py-px text-[10px] leading-4 whitespace-nowrap text-muted-foreground ring-1 ring-foreground/5">{name}</span>)}
    </span>
  );
}
