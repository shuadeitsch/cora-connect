"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Download,
  History,
  House,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Search,
  Table2,
  Trash2,
  Upload,
  Route as RouteIcon,
  Check,
  CircleSlash,
  Minus,
  Share2,
} from "lucide-react";
import { AddressLink } from "@/components/address-link";
import { Avatar } from "@/components/avatar";
import { ImportContacts } from "@/components/import-contacts";
import { Notice, PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { VisitDialog } from "@/components/visit-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateRouteDialog } from "@/components/create-route";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteHouseholdsAction,
  dismissDuplicateAction,
  mergeContactsAction,
  removeContactVisitAction,
  saveHouseholdAction,
} from "@/lib/actions";
import { restoreShliachHiddenAction, shareContactWithBochurimAction } from "@/lib/shliach-prefs-actions";
import { useUndoToast } from "@/components/undo-toast";
import { useRouter } from "next/navigation";
import { shareWithBochurAction } from "@/lib/bochur-actions";
import { CANONICAL_HEADERS, toCsv } from "@/lib/csv";
import { VisitedPicker } from "@/components/visited-picker";
import { isRealVisit } from "@/lib/visited";
import { setViewingState } from "@/lib/viewing-state";
import { FOCUS_STATES, projectLabel, sameState, scopeLabel, stateLabel, visitReactionMeta, VISIT_REACTIONS } from "@/lib/constants";
import { formatMedium, smsHref, telHref, whatsAppHref } from "@/lib/format";
import { CONTACT_TAGS, officialTags } from "@/lib/contact-tags";
import { ContactFilterControls, ContactStateTabs, useContactFilters } from "@/components/contact-filters";
import { labeledVisitNotes, type LabeledNote, visitNoteLabel } from "@/lib/visit-notes";
import { visitStatusChip, visitStatusLabel } from "@/lib/visit-status";
import { TOWNS } from "@/lib/geo";
import type { AppData, HouseholdInput, HouseholdReaction, HouseholdView } from "@/lib/types";
import { cn } from "@/lib/utils";

const control = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

const SORT_ORDERS = [
  ["name", "Name A–Z"],
  ["name_desc", "Name Z–A"],
  ["newest", "Newest"],
  ["city", "City"],
  ["state", "State"],
  ["visited", "Visited"],
] as const;

export function HouseholdsView({
  data,
  openNew,
  openImport,
  focusId,
}: {
  data: AppData;
  openNew: boolean;
  openImport: boolean;
  initialDue: boolean;
  focusId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const announce = useUndoToast();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [gone, setGone] = useState<string[]>([]);
  const [sort, setSort] = useState("name");
  const filterCtl = useContactFilters(data, query, gone);
  const { filters } = filterCtl;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [routeFromPicked, setRouteFromPicked] = useState(false);
  const [editing, setEditing] = useState<HouseholdView | null>(null);
  const [creating, setCreating] = useState(openNew);
  const [importOpen, setImportOpen] = useState(openImport);
  const [contact, setContact] = useState<HouseholdView | null>(null);
  const [history, setHistory] = useState<HouseholdView | null>(null);
  const openById = (id: string) => {
    const match = data.households.find((item) => item.id === id);
    if (match) setContact(match);
  };
  const [visitFor, setVisitFor] = useState<HouseholdView | null>(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    setViewingState(filters.state);
  }, [filters.state]);

  useEffect(() => () => setViewingState(null), []);

  useEffect(() => {
    const saved = window.localStorage.getItem("cora-household-view");
    if (saved === "table" || saved === "cards") setView(saved);
  }, []);

  useEffect(() => {
    if (!focusId) return;
    const match = data.households.find((household) => household.id === focusId);
    if (match) setContact(match);
  }, [focusId, data.households]);

  useEffect(() => {
    setHistory((current) => {
      if (!current) return current;
      return data.households.find((household) => household.id === current.id) ?? current;
    });
    setContact((current) => {
      if (!current) return current;
      return data.households.find((household) => household.id === current.id) ?? current;
    });
  }, [data.households]);

  const filtered = useMemo(() => {
    const rows = [...filterCtl.matched];
    rows.sort((a, b) => {
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "state") return a.state.localeCompare(b.state) || a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
      if (sort === "city") return a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
      if (sort === "visited") return a.latestVisited.localeCompare(b.latestVisited) || a.name.localeCompare(b.name);
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "due") return (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999");
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [filterCtl.matched, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allFiltered = filtered.length > 0 && filtered.every((row) => selected.includes(row.id));
  function showEveryone() {
    filterCtl.resetFilters();
    setQuery("");
    setSort("name");
    setPage(1);
  }

  function download(rows: HouseholdView[]) {
    const csv = toCsv(
      [...CANONICAL_HEADERS],
      rows.flatMap((row) => {
        const person = row.people[0];
        const visits = (row.contactVisits ?? []).filter((visit) => !visit.id.startsWith("legacy-"));
        const unattached = notesFor(row, data.viewer.canViewHistory).filter((note) => note.id === "household-notes");
        const lines = visits.length
          ? visits
          : [{ visited: unattached.length ? "Summer 5786" : row.latestVisited, status: unattached.length ? "deferred" as const : "completed" as const, reaction: row.latestReaction, notes: unattached.map((note) => note.notes).join("\n\n"), visitDate: "" }];
        return lines.map((visit) => [
          row.name,
          person?.phone ?? "",
          person?.email ?? "",
          row.street,
          row.city,
          row.state,
          row.zip,
          officialTags(row.tags).join("; "),
          visit.visited,
          visitStatusLabel(visit.status),
          visitReactionMeta(visit.reaction)?.label ?? "",
          visit.notes,
          visit.visitDate ?? "",
        ]);
      }),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cora-contacts.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function setViewMode(next: "cards" | "table") {
    setView(next);
    window.localStorage.setItem("cora-household-view", next);
  }

  function remove(ids: string[]) {
    setPendingDelete(null);
    setGone((current) => [...new Set([...current, ...ids])]);
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    setContact((current) => (current && ids.includes(current.id) ? null : current));
    start(async () => {
      const result = await deleteHouseholdsAction(ids);
      if (!result.ok) {
        setGone((current) => current.filter((id) => !ids.includes(id)));
        setError(result.error);
        toast({ title: result.error, tone: "error" });
        return;
      }
      const title = ids.length === 1 ? "Contact removed" : `${ids.length} contacts removed`;
      announce(result, title, () => setGone((current) => current.filter((id) => !ids.includes(id))));
    });
  }

  function restoreHidden(ids: string[]) {
    start(async () => {
      const result = await restoreShliachHiddenAction(ids);
      if (!result.ok) {
        setError(result.error);
        toast({ title: result.error, tone: "error" });
        return;
      }
      setSelected([]);
      toast({ title: ids.length === 1 ? "Contact restored" : `${ids.length} contacts restored` });
      router.refresh();
    });
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={scopeLabel(data.viewer.role, data.viewer.territory, filters.state)}
        crumb="Contacts"
        action={
          data.viewer.canEdit || data.viewer.canManage ? (
            <div className="flex flex-wrap gap-2">
              {data.viewer.canManage ? (
                <Button variant="outline" className="rounded-full" onClick={() => download(selected.length ? filtered.filter((row) => selected.includes(row.id)) : filtered)}>
                  <Download /> Export
                </Button>
              ) : null}
              {data.viewer.canEdit ? (
                <>
                  {data.viewer.canImport ? (
                    <Button variant="outline" className="rounded-full" onClick={() => setImportOpen(true)}>
                      <Upload /> Import
                    </Button>
                  ) : null}
                  <Button className="rounded-full" onClick={() => setCreating(true)}>
                    <Plus /> New Contact
                  </Button>
                </>
              ) : null}
            </div>
          ) : null
        }
      />
      {data.viewer.role === "shliach" && !data.viewer.territory.length ? (
        <div className="mb-3"><Notice>A Cora Connect admin still needs to assign your states before you can add contacts.</Notice></div>
      ) : null}
      {error ? <div className="mb-3"><Notice>{error}</Notice></div> : null}
      <ContactStateTabs ctl={filterCtl} className="mb-3" onChange={() => setPage(1)} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ContactFilterControls ctl={filterCtl} onChange={() => setPage(1)} />
        <select
          aria-label="Order"
          title="Order"
          className={cn(pill, "w-auto max-w-[8.5rem] pr-2")}
          value={sort}
          onChange={(event) => { setSort(event.target.value); setPage(1); }}
        >
          {SORT_ORDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button
          type="button"
          className={cn(pill, !filters.mode && !query && sort === "name" && "bg-primary text-primary-foreground")}
          onClick={showEveryone}
        >
          All contacts
        </button>
        {selected.length && data.viewer.canCreateRoute ? (
          <button type="button" className={pill} onClick={() => setRouteFromPicked(true)}>
            <RouteIcon className="size-3.5" /> Build route ({selected.length})
          </button>
        ) : null}
        {selected.length && data.viewer.canShare ? (
          <ShareWithBochur data={data} ids={selected} className={pill} />
        ) : null}
        {selected.length && data.viewer.canDeleteContacts && filters.list !== "shliach-deleted" ? (
          <button type="button" className={`${pill} text-red-600`} onClick={() => setPendingDelete(selected)}>
            <Trash2 className="size-3.5" /> Delete {selected.length} contact{selected.length === 1 ? "" : "s"}
          </button>
        ) : null}
        {selected.length && data.viewer.role === "admin" && filters.list === "shliach-deleted" ? (
          <button type="button" className={pill} onClick={() => restoreHidden(selected)}>
            Restore {selected.length} contact{selected.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
      {filters.list === "tagged" ? <p className="mb-3 text-sm text-muted-foreground">Tagged contacts stay off the main list. Search still finds them from the main list.</p> : null}
      {filters.list === "shliach-deleted" ? <p className="mb-3 text-sm text-muted-foreground">Contacts a shliach soft-deleted. Restore to put them back on his list.</p> : null}
      <div className="panel overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <div className="relative min-w-0 basis-full sm:flex-1">
            <Search className="absolute top-3.5 left-3 size-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, phone, or email" className="w-full pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-muted p-1">
              <button type="button" aria-pressed={view === "cards"} aria-label="Card view" className={view === "cards" ? "inline-flex size-10 items-center justify-center rounded-full bg-card text-foreground shadow-sm" : "inline-flex size-10 items-center justify-center rounded-full text-muted-foreground"} onClick={() => setViewMode("cards")}>
                <LayoutGrid className="size-4" />
              </button>
              <button type="button" aria-pressed={view === "table"} aria-label="Table view" className={view === "table" ? "inline-flex size-10 items-center justify-center rounded-full bg-card text-foreground shadow-sm" : "inline-flex size-10 items-center justify-center rounded-full text-muted-foreground"} onClick={() => setViewMode("table")}>
                <Table2 className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing
              <select className="mx-1 h-10 rounded-lg border bg-card px-1" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              of {filtered.length}
            </p>
          </div>
        </div>
        {view === "cards" ? (
          slice.length ? (
            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {slice.map((household) => (
                <article key={household.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/40 p-4 transition duration-200 hover:-translate-y-0.5">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.includes(household.id)}
                      onCheckedChange={(value) => setSelected(value ? [...selected, household.id] : selected.filter((id) => id !== household.id))}
                      aria-label={`Select ${household.name}`}
                    />
                    <Avatar name={household.name} />
                    <div className="min-w-0 flex-1">
                      <button type="button" className="text-left font-heading text-lg font-semibold text-foreground" onClick={() => setContact(household)}>{household.name}</button>
                      <p className="truncate text-sm text-muted-foreground">
                        {household.address ? (
                          <AddressLink address={household.address} lat={household.lat} lng={household.lng} className="max-w-full truncate">
                            {[household.city, household.state].filter(Boolean).join(", ") || household.address}
                          </AddressLink>
                        ) : "No address yet"}
                      </p>
                    </div>
                    <DueBadge state={household.dueState} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <VisitChips visits={household.contactVisits ?? []} />
                    <ReactionBadge reaction={household.latestReaction} />
                    <DuplicateNote household={household} onOpen={openById} className="w-full rounded-2xl bg-amber-500/15 px-2 py-1 text-[11px]" />
                    <TagBadges tags={household.tags} />
                    {household.sharedWithCora ? null : <span className="text-xs">Private</span>}
                    {household.deletedByShliachAt ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                        Deleted by shliach{household.deletedByShliachName ? ` (${household.deletedByShliachName}` : ""}{household.deletedByShliachAt ? `, ${household.deletedByShliachAt.slice(0, 10)}` : ""}{household.deletedByShliachName ? ")" : ""}
                      </span>
                    ) : null}
                  </div>
                  <NotePreview notes={notesFor(household, data.viewer.canViewHistory)} compact />
                  <div className="mt-auto flex gap-2">
                    <Button size="sm" variant="outline" className="h-10 flex-1 rounded-full" onClick={() => setContact(household)}>Contact</Button>
                    <Button size="sm" variant="outline" className="h-10 flex-1 rounded-full" disabled={!data.viewer.canLogVisit} onClick={() => setVisitFor(household)}>Visit</Button>
                    <Button size="sm" variant="outline" className="h-10 rounded-full" onClick={() => setHistory(household)}>History</Button>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyHouseholds />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[12.5px]">
            <thead className="text-[11px] tracking-wide text-mutedink uppercase">
              <tr className="border-b">
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allFiltered}
                    onCheckedChange={(value) => {
                      if (value) setSelected(filtered.map((row) => row.id));
                      else setSelected([]);
                    }}
                    aria-label="Select all filtered contacts"
                  />
                </th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Contact</th>
                <th className="px-2 py-2 font-medium">Report</th>
                <th className="px-2 py-2 font-medium">History</th>
                <th className="px-2 py-2 font-medium">Visited</th>
                <th className="px-2 py-2 font-medium">Reaction</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {slice.map((household) => (
                <tr key={household.id} className="border-b last:border-0 hover:bg-muted">
                  <td className="px-3 py-1.5">
                    <Checkbox
                      checked={selected.includes(household.id)}
                      onCheckedChange={(value) => setSelected(value ? [...selected, household.id] : selected.filter((id) => id !== household.id))}
                      aria-label={`Select ${household.name}`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={household.name} className="size-8 text-[10px]" />
                      <div>
                        <button type="button" className="text-left font-semibold text-foreground hover:text-primary" onClick={() => setContact(household)}>
                          {household.name}
                        </button>
                        <div className="text-[11px] text-muted-foreground">
                          {household.address ? (
                            <AddressLink address={household.address} lat={household.lat} lng={household.lng}>
                              {[household.city, household.state].filter(Boolean).join(", ") || household.address}
                            </AddressLink>
                          ) : "No address yet"}
                        </div>
                        <TagBadges tags={household.tags} />
                        <NotePreview notes={notesFor(household, data.viewer.canViewHistory)} compact />
                      </div>
                    </div>
                  </td>
                  <td className="px-2"><IconAction label="View contact" onClick={() => setContact(household)} icon={MapPin} /></td>
                  <td className="px-2"><IconAction label="Log visit" onClick={() => setVisitFor(household)} icon={Pencil} disabled={!data.viewer.canLogVisit} /></td>
                  <td className="px-2"><IconAction label="Visit history" onClick={() => setHistory(household)} icon={History} /></td>
                  <td className="max-w-[16rem] px-2 text-muted-foreground">
                    <VisitChips visits={household.contactVisits ?? []} />
                    <DuplicateNote household={household} onOpen={openById} className="mt-1 block text-[11px]" />
                  </td>
                  <td className="px-2"><ReactionBadge reaction={household.latestReaction} /></td>
                  <td className="px-2">
                    <button type="button" aria-label={`Delete ${household.name}`} disabled={!data.viewer.canDeleteContacts} className="text-muted-foreground hover:text-red-600 disabled:opacity-30" onClick={() => setPendingDelete([household.id])}>
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!slice.length ? <EmptyHouseholds /> : null}
        </div>
        )}
        <Pager page={safePage} pages={pages} onPage={setPage} />
      </div>

      <HouseholdDialog
        open={creating || Boolean(editing)}
        title={editing ? "Edit contact" : "New contact"}
        data={data}
        household={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
      />
      <ImportContacts open={importOpen} data={data} onClose={() => setImportOpen(false)} />
      <ContactDialog
        household={contact}
        households={data.households}
        canEdit={data.viewer.canEdit}
        canContact={data.viewer.canViewContact}
        canHistory={data.viewer.canViewHistory}
        onClose={() => setContact(null)}
        onOpenOther={openById}
        onEdit={() => { if (contact) { setEditing(contact); setContact(null); } }}
        onVisit={() => { if (contact) { setVisitFor(contact); setContact(null); } }}
        onHistory={() => { if (contact) { setHistory(contact); setContact(null); } }}
      />
      <HistoryDialog
        household={history}
        canHistory={data.viewer.canViewHistory}
        onClose={() => setHistory(null)}
      />
      <VisitDialog
        open={Boolean(visitFor)}
        onOpenChange={(open) => { if (!open) setVisitFor(null); }}
        households={data.households.map((household) => ({ id: household.id, name: household.name }))}
        initial={visitFor ? { householdId: visitFor.id, visitDate: "", status: "", reaction: "", details: "" } : undefined}
      />
      <CreateRouteDialog data={data} ids={selected} open={routeFromPicked} onClose={() => setRouteFromPicked(false)} onSaved={() => setSelected([])} />
      <Dialog open={Boolean(pendingDelete?.length)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">
              Delete {pendingDelete?.length ?? 0} contact{(pendingDelete?.length ?? 0) === 1 ? "" : "s"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Their visits are removed with them. You can undo this right after.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="rounded-full" onClick={() => { if (pendingDelete) remove(pendingDelete); }}>
              Delete {pendingDelete?.length ?? 0} contact{(pendingDelete?.length ?? 0) === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const pill = "inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground transition hover:bg-muted active:scale-[0.98]";

function ReactionBadge({ reaction }: { reaction: HouseholdReaction | null }) {
  const meta = visitReactionMeta(reaction);
  if (!meta) return null;
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", meta.className)}>{meta.label}</span>;
}

function visitChipLabel(visit: HouseholdView["contactVisits"][number]) {
  const name = visit.visited.trim() ? projectLabel(visit.visited) : "";
  const date = visit.visitDate ? formatMedium(visit.visitDate) : "";
  return name || date || "Visit";
}

/** Share the picked contacts with one of your bochurim, or take them back. */
function ShareWithBochur({ data, ids, className }: { data: AppData; ids: string[]; className: string }) {
  const router = useRouter();
  const bochurim = data.members.filter((member) => member.kind === "member" && member.role === "bochur" && member.status === "approved" && (data.viewer.canManage || member.leaderId === data.viewer.id));
  const [open, setOpen] = useState(false);
  const [bochurId, setBochurId] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const chosen = bochurId || bochurim[0]?.id || "";
  function go(share: boolean) {
    setNote("");
    start(async () => {
      const result = await shareWithBochurAction(ids, chosen, share);
      if (!result.ok) { setNote(result.error); return; }
      const name = bochurim.find((member) => member.id === chosen)?.name ?? "the bochur";
      setNote(share ? `Shared ${ids.length} with ${name}.` : `${name} no longer sees ${result.count ?? 0} of these.`);
      router.refresh();
    });
  }
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setNote(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className={className}><Share2 className="size-3.5" /> Share with bochur ({ids.length})</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-[min(20rem,calc(100vw-1.5rem))] gap-2">
        {bochurim.length ? (
          <>
            <select aria-label="Bochur" className="h-11 rounded-lg border border-input bg-card px-3 text-sm" value={chosen} onChange={(event) => setBochurId(event.target.value)}>
              {bochurim.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <div className="flex gap-2">
              <Button type="button" className="min-h-11 flex-1 rounded-full" disabled={pending || !chosen} onClick={() => go(true)}>Share {ids.length}</Button>
              <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-full" disabled={pending || !chosen} onClick={() => go(false)}>Unshare</Button>
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground">No active bochurim yet.</p>}
        {note ? <p role="status" className="text-sm text-foreground">{note}</p> : null}
      </PopoverContent>
    </Popover>
  );
}

/** "Possible duplicate" with the plain reason and a link to the matching contact. */
function DuplicateNote({ household, onOpen, className }: { household: HouseholdView; onOpen?: (id: string) => void; className?: string }) {
  if (!household.possibleDuplicate) return null;
  const reason = household.duplicateReason || "Flagged on import";
  const id = household.duplicateMatchId;
  return (
    <span className={cn("text-amber-900 dark:text-amber-200", className)}>
      <span className="font-medium">Possible duplicate</span>
      {" · "}
      {reason}
      {id && household.duplicateOfName ? (
        <>
          {" "}
          {onOpen ? (
            <button type="button" className="font-medium underline underline-offset-2 hover:text-primary" onClick={(event) => { event.stopPropagation(); onOpen(id); }}>
              {household.duplicateOfName}
            </button>
          ) : <span className="font-medium">{household.duplicateOfName}</span>}
        </>
      ) : null}
      {household.canMarkNotDuplicate ? <NotDuplicateButton household={household} /> : null}
    </span>
  );
}

/** Clears the flag and remembers the pair so imports and matching skip it. Undo in the toast. */
function NotDuplicateButton({ household }: { household: HouseholdView }) {
  const announce = useUndoToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-700/30 bg-background/70 px-2 py-0.5 align-middle font-medium text-foreground hover:bg-background disabled:opacity-50"
      onClick={(event) => {
        event.stopPropagation();
        start(async () => {
          announce(await dismissDuplicateAction(household.id, household.duplicateMatchId), `${household.name} marked not a duplicate`);
        });
      }}
    >
      <Check className="size-3" /> Not a duplicate
    </button>
  );
}

function VisitStatusIcon({ status }: { status: HouseholdView["contactVisits"][number]["status"] }) {
  const Icon = status === "completed" ? Check : status === "deferred" ? CircleSlash : Minus;
  return <Icon aria-hidden className="size-3 shrink-0" strokeWidth={2.75} />;
}

/** Color = visit status only (green visited, red deferred, gray no status); the icon and label say the same thing. */
function VisitChip({ visit, wide }: { visit: HouseholdView["contactVisits"][number]; wide?: boolean }) {
  const chip = visitStatusChip(visit.status);
  const label = visitChipLabel(visit);
  const full = visitNoteLabel(visit.visited, visit.visitDate, formatMedium);
  return (
    <span
      title={`${full} · ${chip.label}`}
      aria-label={`${full}: ${chip.label}`}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap", wide ? "max-w-full" : "max-w-[8.5rem]", chip.className)}
    >
      <VisitStatusIcon status={visit.status} />
      <span className="truncate">{label}</span>
    </span>
  );
}

// Newest first. Two chips fit on one line; the rest sit behind +N.
function VisitChips({ visits: all }: { visits: HouseholdView["contactVisits"] }) {
  const visits = all.filter((visit) => isRealVisit(visit.visited));
  if (!visits.length) return <span className="text-[11px]">Not visited</span>;
  const shown = visits.slice(0, 2);
  const more = visits.length - shown.length;
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1">
      {shown.map((visit) => <VisitChip key={visit.id} visit={visit} />)}
      {more > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Show all ${visits.length} visits`}
              className="inline-flex h-5 shrink-0 items-center rounded-full border border-border bg-card px-1.5 text-[11px] leading-4 font-medium text-foreground hover:bg-muted"
            >
              +{more}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 gap-1 p-2">
            {visits.map((visit) => {
              return (
                <div key={visit.id} className="flex items-center justify-between gap-2 text-xs">
                  <VisitChip visit={visit} wide />
                  <ReactionBadge reaction={visit.reaction} />
                </div>
              );
            })}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function DueBadge({ state }: { state: HouseholdView["dueState"] }) {
  if (state === "overdue") return <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">Overdue</span>;
  if (state === "due") return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">Due</span>;
  return null;
}

function EmptyHouseholds() {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <House className="size-6" />
      </span>
      <p className="font-heading text-xl text-foreground">No contacts here</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try another filter, or add a contact when you are ready.</p>
    </div>
  );
}

function IconAction({ label, onClick, icon: Icon, disabled }: { label: string; onClick: () => void; icon: typeof History; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-primary hover:bg-accent disabled:opacity-30">
      <Icon className="size-3.5" />
    </button>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  const windowed = Array.from({ length: pages }, (_, index) => index + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <div className="flex items-center justify-end gap-1 px-3 py-3">
      {windowed.map((n, index) => (
        <span key={n} className="flex items-center">
          {index > 0 && windowed[index - 1] !== n - 1 ? <span className="px-1 text-mutedink">…</span> : null}
          <button type="button" onClick={() => onPage(n)} className={n === page ? "size-8 rounded-full bg-primary text-sm text-primary-foreground" : "size-8 rounded-full text-sm text-foreground hover:bg-muted"}>
            {n}
          </button>
        </span>
      ))}
    </div>
  );
}

function blankInput(data: AppData): HouseholdInput {
  return {
    name: "",
    street: "",
    city: "",
    state: data.viewer.role === "shliach" ? stateLabel(data.viewer.territory.find((row) => row.state)?.state ?? "") : "",
    zip: "",
    country: "USA",
    lat: "",
    lng: "",
    notes: "",
    projectId: "",
    scheduleCategoryId: "",
    categoryIds: [],
    tags: "",
    customFields: Object.fromEntries(data.customFields.map((field) => [field.id, ""])),
    sharedWithCora: true,
    ownerId: "",
    visitReaction: "",
    visits: [],
    people: [{ name: "", gender: "", phone: "", email: "", whatsapp: "" }],
  };
}

function fromHousehold(household: HouseholdView, data: AppData): HouseholdInput {
  return {
    id: household.id,
    name: household.name,
    street: household.street,
    city: household.city,
    state: household.state,
    zip: household.zip,
    country: household.country,
    lat: household.lat?.toString() ?? "",
    lng: household.lng?.toString() ?? "",
    notes: household.notes,
    projectId: household.projectId ?? "",
    scheduleCategoryId: household.scheduleCategoryId ?? "",
    categoryIds: household.categoryIds,
    tags: household.tags.join(", "),
    customFields: Object.fromEntries(data.customFields.map((field) => [field.id, household.customFields[field.id] ?? ""])),
    sharedWithCora: household.sharedWithCora,
    sharedWithBochurim: household.sharedWithBochurim,
    ownerId: household.ownerId ?? "",
    visitReaction: household.visitReaction ?? "",
    visits: (household.contactVisits ?? [])
      .filter((visit) => !visit.id.startsWith("legacy-"))
      .map((visit) => ({
        id: visit.id,
        visited: visit.visited,
        reaction: visit.reaction ?? "",
        notes: visit.notes,
        visitDate: visit.visitDate ?? "",
        status: visit.status ?? "",
      })),
    people: [{
      id: household.people[0]?.id,
      name: household.name,
      gender: "",
      phone: household.people[0]?.phone ?? "",
      email: household.people[0]?.email ?? "",
      whatsapp: household.people[0]?.phone ?? "",
    }],
  };
}

function HouseholdDialog({ open, title, data, household, onClose }: { open: boolean; title: string; data: AppData; household: HouseholdView | null; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<HouseholdInput>(blankInput(data));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const announce = useUndoToast();
  const shliachStates = [...new Set(data.viewer.territory.map((row) => stateLabel(row.state)).filter(Boolean))];
  const phone = form.people[0]?.phone ?? "";
  const email = form.people[0]?.email ?? "";

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(household ? fromHousehold(household, data) : blankInput(data));
  }, [open, household, data]);

  function setContact(patch: { phone?: string; email?: string }) {
    setForm((current) => ({
      ...current,
      people: [{
        id: current.people[0]?.id,
        name: current.name,
        gender: "",
        phone: patch.phone ?? current.people[0]?.phone ?? "",
        email: patch.email ?? current.people[0]?.email ?? "",
        whatsapp: patch.phone ?? current.people[0]?.phone ?? "",
      }],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-heading text-foreground">{title}</DialogTitle></DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const payload: HouseholdInput = {
              ...form,
              people: [{
                id: form.people[0]?.id,
                name: form.name,
                gender: "",
                phone,
                email,
                whatsapp: phone,
              }],
            };
            start(async () => {
              try {
                const result = await saveHouseholdAction(payload);
                if (!result.ok) {
                  setError(result.error);
                  toast({ title: result.error, tone: "error" });
                  return;
                }
                const id = result.data?.id ?? household?.id;
                if (id && typeof payload.sharedWithBochurim === "boolean" && (data.viewer.role === "shliach" || data.viewer.role === "admin")) {
                  const share = await shareContactWithBochurimAction(id, payload.sharedWithBochurim);
                  if (!share.ok) {
                    setError(share.error);
                    toast({ title: share.error, tone: "error" });
                    return;
                  }
                }
                announce(result, household ? "Contact updated" : "Contact saved");
                onClose();
              } catch (caught) {
                const message = caught instanceof Error ? caught.message : "Could not save the contact.";
                setError(message);
                toast({ title: message, tone: "error" });
              }
            });
          }}
        >
          <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Name</span><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Phone</span><Input value={phone} onChange={(event) => setContact({ phone: event.target.value })} inputMode="tel" /></label>
            <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Email</span><Input value={email} onChange={(event) => setContact({ email: event.target.value })} inputMode="email" /></label>
          </div>
          <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Address</span><Input value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-sm sm:col-span-2"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">City</span><Input list="cora-towns" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
            {data.viewer.role === "shliach" && shliachStates.length ? (
              <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">State</span>
                <select className={control} value={shliachStates.find((state) => sameState(state, form.state)) ?? ""} onChange={(event) => setForm({ ...form, state: event.target.value })}>
                  <option value="">Territory default</option>
                  {shliachStates.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
            ) : null}
            <label className="grid gap-1 text-sm"><span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Zip</span><Input value={form.zip} onChange={(event) => setForm({ ...form, zip: event.target.value })} /></label>
          </div>
          {data.viewer.role === "shliach" && shliachStates.length ? null : (
            <div className="grid gap-1.5 text-sm">
              <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">State</span>
              <div className="flex flex-wrap gap-1.5">
                {FOCUS_STATES.map((state) => (
                  <button
                    key={state.code}
                    type="button"
                    aria-pressed={sameState(form.state, state.code)}
                    className={cn(
                      "h-8 rounded-full px-3 text-xs font-medium",
                      sameState(form.state, state.code) ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                    onClick={() => setForm({ ...form, state: sameState(form.state, state.code) ? "" : state.name })}
                  >
                    {state.name}
                  </button>
                ))}
              </div>
              <Input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} placeholder="State, if you have one" />
            </div>
          )}
          <datalist id="cora-towns">{TOWNS.map((town) => <option key={`${town.city}-${town.state}`} value={town.city}>{town.city}, {town.state}</option>)}</datalist>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Visits</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setForm({ ...form, visits: [...form.visits, { visited: "", status: "completed", reaction: "", notes: "", visitDate: "" }] })}
              >
                Add visit
              </Button>
            </div>
            {form.visits.length ? form.visits.map((visit, index) => (
              <div key={visit.id ?? index} className="grid gap-2 rounded-2xl border p-3">
                <div className="grid gap-2">
                  <VisitedPicker value={visit.visited} onChange={(visited) => {
                    const visits = form.visits.map((item, at) => at === index ? { ...item, visited } : item);
                    setForm({ ...form, visits });
                  }} />
                  <label className="grid gap-1 text-sm">
                    <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Visit date</span>
                    <Input type="date" value={visit.visitDate} onChange={(event) => {
                      const visits = form.visits.map((item, at) => at === index ? { ...item, visitDate: event.target.value } : item);
                      setForm({ ...form, visits });
                    }} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["completed", "deferred"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={cn("rounded-full px-2.5 py-1 text-xs font-medium", visit.status === status ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}
                      onClick={() => {
                        const visits = form.visits.map((item, at) => at === index ? { ...item, status } : item);
                        setForm({ ...form, visits });
                      }}
                    >
                      {visitStatusLabel(status)}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VISIT_REACTIONS.map((reaction) => (
                    <button
                      key={reaction.id}
                      type="button"
                      className={cn("rounded-full px-2.5 py-1 text-xs font-medium", visit.reaction === reaction.id ? reaction.className : "bg-muted text-foreground")}
                      onClick={() => {
                        const visits = form.visits.map((item, at) => at === index ? { ...item, reaction: item.reaction === reaction.id ? "" : reaction.id } : item);
                        setForm({ ...form, visits });
                      }}
                    >
                      {reaction.label}
                    </button>
                  ))}
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">
                    Notes{visit.visited.trim() ? ` · ${visitNoteLabel(visit.visited, visit.visitDate || null, formatMedium)}` : ""}
                  </span>
                <Textarea
                  value={visit.notes}
                  rows={2}
                  placeholder="Notes from this visit"
                  onChange={(event) => {
                    const visits = form.visits.map((item, at) => at === index ? { ...item, notes: event.target.value } : item);
                    setForm({ ...form, visits });
                  }}
                />
                </label>
                <button
                  type="button"
                  className="justify-self-start text-xs text-red-600"
                  onClick={() => setForm({ ...form, visits: form.visits.filter((_, at) => at !== index) })}
                >
                  Remove visit
                </button>
              </div>
            )) : <p className="text-sm text-muted-foreground">No visits yet. Every field on a visit can stay blank.</p>}
          </div>
          <div className="grid gap-1.5 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {CONTACT_TAGS.map((tag) => {
                const selected = officialTags(form.tags.split(",")).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    className={cn("h-8 rounded-full px-3 text-xs font-medium", selected ? "bg-amber-700 text-white" : "bg-muted text-foreground")}
                    onClick={() => {
                      const current = officialTags(form.tags.split(","));
                      const next = selected ? current.filter((item) => item !== tag) : [...current, tag];
                      setForm({ ...form, tags: next.join(", ") });
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Tagged contacts stay off the main list. Search still finds them.</p>
          </div>
          {data.viewer.role === "shliach" || data.viewer.role === "admin" ? (
            <>
              {data.viewer.role === "shliach" ? (
                <label className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm">
                  <span>
                    <span className="block font-medium text-foreground">Share with Cora</span>
                    <span className="text-xs text-muted-foreground">Shared contacts also show on the Cora overview.</span>
                  </span>
                  <input type="checkbox" className="size-5 accent-primary" checked={form.sharedWithCora} onChange={(event) => setForm({ ...form, sharedWithCora: event.target.checked })} />
                </label>
              ) : null}
              <label className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm">
                <span>
                  <span className="block font-medium text-foreground">Shared with bochurim</span>
                  <span className="text-xs text-muted-foreground">All of your bochurim can see this contact.</span>
                </span>
                <input type="checkbox" className="size-5 accent-primary" checked={Boolean(form.sharedWithBochurim)} onChange={(event) => setForm({ ...form, sharedWithBochurim: event.target.checked })} />
              </label>
            </>
          ) : null}
          {error ? <Notice>{error}</Notice> : null}
          <div className="flex justify-end"><Button type="submit" disabled={pending} className="rounded-full">{pending ? "Saving…" : "Save contact"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContactDialog({
  household,
  households,
  canEdit,
  canContact,
  canHistory,
  onClose,
  onEdit,
  onVisit,
  onHistory,
  onOpenOther,
}: {
  household: HouseholdView | null;
  households: HouseholdView[];
  canEdit: boolean;
  canContact: boolean;
  canHistory: boolean;
  onClose: () => void;
  onEdit: () => void;
  onVisit: () => void;
  onHistory: () => void;
  onOpenOther: (id: string) => void;
}) {
  const announce = useUndoToast();
  const [mergeInto, setMergeInto] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    setMergeInto(household?.duplicateOf ?? "");
  }, [household]);
  const others = households.filter((item) => item.id !== household?.id);
  return (
    <Dialog open={Boolean(household)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        {household ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-8">
                <DialogTitle className="font-heading text-foreground">Contact</DialogTitle>
                {canEdit ? <Button size="sm" variant="outline" className="rounded-full" onClick={onEdit}><Pencil className="size-3.5" /> Edit</Button> : null}
              </div>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={onHistory}><History className="size-4" /> History</Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={onVisit}><Pencil className="size-4" /> Report</Button>
            </div>
            <section>
              <p className="font-heading text-2xl font-semibold text-foreground">{household.name}</p>
              {household.possibleDuplicate ? (
                <p className="mt-2 text-sm"><DuplicateNote household={household} onOpen={onOpenOther} /></p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <ReactionBadge reaction={household.latestReaction} />
                <TagBadges tags={household.tags} />
                <VisitChips visits={household.contactVisits ?? []} />
              </div>
              <div className="mt-3">
                <NotePreview notes={notesFor(household, canHistory)} />
              </div>
              {canContact ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {household.people.some((person) => person.phone) ? household.people.filter((person) => person.phone).map((person) => (
                    <span key={person.id} className="flex flex-wrap gap-2">
                      <ActionLink href={telHref(person.phone)} icon={Phone} label="Call" />
                      <ActionLink href={smsHref(person.phone)} icon={MessageSquare} label="Text" />
                      <ActionLink href={whatsAppHref(person.whatsapp || person.phone)} icon={MessageCircle} label="WhatsApp" />
                    </span>
                  )) : null}
                  {household.people.filter((person) => person.email).map((person) => (
                    <ActionLink key={`${person.id}-email`} href={`mailto:${person.email}`} icon={Mail} label="Email" />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-mutedink">Phone and email are hidden for your access.</p>
              )}
              <p className="mt-3 text-xs tracking-wide text-mutedink uppercase">Address</p>
              <div className="flex items-start justify-between gap-2">
                {household.address ? (
                  <AddressLink address={household.address} lat={household.lat} lng={household.lng} className="text-sm text-link" />
                ) : <p className="text-sm text-link">No address yet</p>}
                {household.address ? (
                  <AddressLink address={household.address} lat={household.lat} lng={household.lng} label="Navigate" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary hover:no-underline">
                    <MapPin className="size-4" />
                  </AddressLink>
                ) : null}
              </div>
            </section>
            {household.possibleDuplicate && canEdit ? (
              <section className="grid gap-2 border-t pt-3 text-sm">
                <label className="grid gap-1">
                  <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Merge into</span>
                  <select className={control} value={mergeInto} onChange={(event) => setMergeInto(event.target.value)}>
                    <option value="">Choose a contact</option>
                    {others.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={pending || !mergeInto}
                    onClick={() => start(async () => {
                      const result = await mergeContactsAction(household.id, mergeInto);
                      if (announce(result, "Contacts merged")) onClose();
                    })}
                  >
                    Merge into…
                  </Button>
                </div>
              </section>
            ) : null}
            {!canHistory ? <p className="text-xs text-mutedink">Visit notes are hidden for your access.</p> : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ActionLink({ href, icon: Icon, label }: { href: string; icon: typeof Phone; label: string }) {
  return (
    <a href={href} className="inline-flex h-10 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground">
      <Icon className="size-3.5" /> {label}
    </a>
  );
}

function HistoryDialog({ household, canHistory, onClose }: { household: HouseholdView | null; canHistory: boolean; onClose: () => void }) {
  const visits = household?.contactVisits ?? [];
  const announce = useUndoToast();
  const [confirming, setConfirming] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    setConfirming("");
  }, [household?.id]);
  return (
    <Dialog open={Boolean(household)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-heading text-foreground">Visit history</DialogTitle></DialogHeader>
        {!canHistory ? (
          <p className="text-sm text-mutedink">Visit history is hidden for your access.</p>
        ) : (
          <div className="space-y-3">
            {visits.length ? visits.map((visit) => {
              const reaction = visitReactionMeta(visit.reaction);
              const label = visitNoteLabel(visit.visited, visit.visitDate, formatMedium);
              return (
                <article key={visit.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{label}</p>
                      <p className="mt-1"><VisitChip visit={visit} wide /></p>
                    </div>
                    {visit.canRemove && confirming !== visit.id ? (
                      <button
                        type="button"
                        aria-label={`Remove visit ${label}`}
                        title="Remove visit"
                        className="-mt-1 -mr-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                        onClick={() => setConfirming(visit.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                  {reaction ? <p className="mt-2"><ReactionBadge reaction={visit.reaction} /></p> : null}
                  {visit.notes ? (
                    <div className="mt-2">
                      <p className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Notes from {label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-foreground">{visit.notes}</p>
                    </div>
                  ) : null}
                  {confirming === visit.id ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 p-2">
                      <p className="font-medium text-red-800">Remove this visit?</p>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="h-10 rounded-full" disabled={pending} onClick={() => setConfirming("")}>Cancel</Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="h-10 rounded-full"
                          disabled={pending}
                          onClick={() => start(async () => {
                            const result = await removeContactVisitAction(visit.id);
                            if (announce(result, "Visit removed")) setConfirming("");
                          })}
                        >
                          {pending ? "Removing…" : "Remove"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            }) : null}
            {household && canHistory ? notesFor(household, true).filter((note) => note.id === "household-notes").map((note) => (
              <article key={note.id} className="rounded-xl border p-3 text-sm">
                <p className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Notes from {note.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{note.notes}</p>
              </article>
            )) : null}
            {!visits.length && !(household && notesFor(household, canHistory).length) ? <p className="py-6 text-center text-sm text-mutedink">No visits yet.</p> : null}
            {household?.nextDue ? (
              <div className="rounded-xl border p-3 text-sm">
                <p className="text-xs text-mutedink">Next visit</p>
                <p className="font-medium text-foreground">{formatMedium(household.nextDue)} · {household.scheduleName}</p>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TagBadges({ tags }: { tags: string[] }) {
  const shown = officialTags(tags);
  if (!shown.length) return null;
  return (
    <>
      {shown.map((tag) => (
        <span key={tag} className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-950">{tag}</span>
      ))}
    </>
  );
}

function notesFor(household: HouseholdView, canHistory: boolean): LabeledNote[] {
  if (!canHistory) return [];
  return labeledVisitNotes(household.notes, household.contactVisits ?? [], formatMedium);
}

function NotePreview({ notes, compact = false }: { notes: LabeledNote[]; compact?: boolean }) {
  if (!notes.length) return null;
  return (
    <div className={compact ? "grid gap-1" : "grid gap-2"}>
      {notes.map((note) => (
        <p key={note.id} className={compact ? "line-clamp-2 text-sm text-muted-foreground" : "text-sm"}>
          <span className="font-medium text-foreground">{note.label}</span>
          {compact ? <span> — {note.notes}</span> : <span className="mt-0.5 block whitespace-pre-wrap text-foreground">{note.notes}</span>}
        </p>
      ))}
    </div>
  );
}
