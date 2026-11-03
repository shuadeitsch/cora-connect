"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
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
import { useUndoToast } from "@/components/undo-toast";
import { CANONICAL_HEADERS, toCsv } from "@/lib/csv";
import { VisitedPicker } from "@/components/visited-picker";
import { isRealVisit } from "@/lib/visited";
import { setViewingState } from "@/lib/viewing-state";
import { FOCUS_STATES, matchesStateFilter, sameState, scopeLabel, stateLabel, visitReactionMeta, VISIT_REACTIONS } from "@/lib/constants";
import { formatMedium, smsHref, telHref, whatsAppHref } from "@/lib/format";
import { CONTACT_TAGS, matchesTagFilter, officialTags, showInContactList } from "@/lib/contact-tags";
import { labeledVisitNotes, type LabeledNote, visitNoteLabel } from "@/lib/visit-notes";
import { visitStatusLabel } from "@/lib/visit-status";
import { TOWNS } from "@/lib/geo";
import type { AppData, HouseholdInput, HouseholdReaction, HouseholdView } from "@/lib/types";
import { cn } from "@/lib/utils";

const control = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

// Removed visits are already left out of contactVisits, so they never count.
const VISITED_ANY = "__any_visit";
const SEASON_YEAR = /\b5\d{3}$/;

const VISITED_NONE = "__not_visited";

type SortMode = "" | "tags" | "visits" | "duplicates";

/** One key per town, so "Portland", " portland " and "PORTLAND" are the same city. Blank is "". */
function cityKey(city: string): string {
  return city.trim().replace(/\s+/g, " ").toLowerCase();
}

const SORT_ORDERS = [
  ["name", "Name A–Z"],
  ["name_desc", "Name Z–A"],
  ["newest", "Newest"],
  ["city", "City"],
  ["state", "State"],
  ["visited", "Visited"],
] as const;

const emptyFilters = {
  mode: "" as SortMode,
  state: "",
  cities: [] as string[],
  visited: "",
  tag: "",
  duplicates: false,
  list: "main" as "main" | "tagged",
};

function stateTabs(data: AppData): { id: string; label: string }[] {
  if (data.viewer.role === "shliach") {
    const names = [...new Set(data.viewer.territory.map((row) => stateLabel(row.state)).filter(Boolean))];
    const tabs = names.map((name) => ({ id: name, label: name }));
    if (tabs.length > 1) return [{ id: "", label: "All states" }, ...tabs];
    return tabs;
  }
  return [{ id: "", label: "All states" }, ...FOCUS_STATES.map((state) => ({ id: state.name, label: state.name }))];
}

function initialState(data: AppData) {
  const tabs = stateTabs(data);
  if (data.viewer.role === "shliach" && tabs.length === 1) return tabs[0]?.id ?? "";
  return "";
}

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
  const toast = useToast();
  const announce = useUndoToast();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [gone, setGone] = useState<string[]>([]);
  const [filters, setFilters] = useState({ ...emptyFilters, state: initialState(data) });
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<HouseholdView | null>(null);
  const [creating, setCreating] = useState(openNew);
  const [importOpen, setImportOpen] = useState(openImport);
  const [contact, setContact] = useState<HouseholdView | null>(null);
  const [history, setHistory] = useState<HouseholdView | null>(null);
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

  // Everything the filters allow except the city choice, so the Cities counts match what picking a city shows.
  const beforeCity = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.households.filter((household) => {
      if (gone.includes(household.id)) return false;
      const noteHay = data.viewer.canViewHistory
        ? labeledVisitNotes(household.notes, household.contactVisits ?? [], formatMedium).map((note) => `${note.label} ${note.notes}`).join(" ")
        : "";
      const hay = `${household.name} ${household.city} ${household.state} ${household.zip} ${household.tags.join(" ")} ${household.projectName ?? ""} ${noteHay} ${household.people.map((person) => `${person.name} ${person.phone} ${person.email}`).join(" ")}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (filters.tag) {
        if (!matchesTagFilter(household.tags, filters.tag)) return false;
      } else if (!showInContactList(household.tags, q, filters.list)) return false;
      if (filters.state && !matchesStateFilter(household.state, filters.state)) return false;
      if (filters.visited === VISITED_ANY) {
        if (!(household.contactVisits ?? []).some((visit) => isRealVisit(visit.visited))) return false;
      } else if (filters.visited === VISITED_NONE) {
        if ((household.contactVisits ?? []).some((visit) => isRealVisit(visit.visited))) return false;
      } else if (filters.visited) {
        const key = filters.visited.toLowerCase();
        const visits = household.contactVisits ?? [];
        const hit = visits.some((visit) => visit.visited.toLowerCase() === key) || household.latestVisited.toLowerCase() === key;
        if (!hit) return false;
      }
      if (filters.duplicates && !household.possibleDuplicate) return false;
      return true;
    });
  }, [data.households, data.viewer.canViewHistory, query, filters.tag, filters.list, filters.state, filters.visited, filters.duplicates, gone]);

  // Every city in the chosen state, alphabetical, with how many contacts each would show.
  const cityChoices = useMemo(() => {
    if (!filters.state) return [];
    const names = new Map<string, Map<string, number>>();
    for (const household of data.households) {
      if (gone.includes(household.id) || !matchesStateFilter(household.state, filters.state)) continue;
      const key = cityKey(household.city);
      const spelled = household.city.trim().replace(/\s+/g, " ");
      const spellings = names.get(key) ?? new Map<string, number>();
      spellings.set(spelled, (spellings.get(spelled) ?? 0) + 1);
      names.set(key, spellings);
    }
    const counts = new Map<string, number>();
    for (const household of beforeCity) counts.set(cityKey(household.city), (counts.get(cityKey(household.city)) ?? 0) + 1);
    return [...names.entries()]
      .map(([key, spellings]) => ({
        key,
        label: key ? [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] : "No city",
        count: counts.get(key) ?? 0,
      }))
      .sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || a.label.localeCompare(b.label));
  }, [data.households, filters.state, beforeCity, gone]);

  const filtered = useMemo(() => {
    const picked = new Set(filters.cities);
    const rows = picked.size ? beforeCity.filter((household) => picked.has(cityKey(household.city))) : [...beforeCity];
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
  }, [beforeCity, filters.cities, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allFiltered = filtered.length > 0 && filtered.every((row) => selected.includes(row.id));
  // Seasons come from the projects list and from the visits themselves, newest year first.
  const seasonChoices = [...new Set([
    ...data.projects.map((project) => project.name.trim()),
    ...data.households.flatMap((household) => (household.contactVisits ?? []).map((visit) => visit.visited.trim())),
  ])]
    .filter((name) => SEASON_YEAR.test(name))
    .sort((a, b) => (b.match(SEASON_YEAR)?.[0] ?? "").localeCompare(a.match(SEASON_YEAR)?.[0] ?? "") || a.localeCompare(b));

  function chooseMode(mode: SortMode) {
    const base = { ...emptyFilters, state: filters.state, cities: filters.cities, mode };
    if (mode === "tags") setFilters({ ...base, list: "tagged" });
    else if (mode === "duplicates") setFilters({ ...base, duplicates: true });
    else if (mode === "visits") setFilters({ ...base, visited: VISITED_ANY });
    else setFilters(base);
    setPage(1);
  }

  function showEveryone() {
    setFilters({ ...emptyFilters, state: initialState(data) });
    setQuery("");
    setSort("name");
    setPage(1);
  }
  const tabs = stateTabs(data);

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
                  <Button variant="outline" className="rounded-full" onClick={() => setImportOpen(true)}>
                    <Upload /> Import
                  </Button>
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
        <div className="mb-3"><Notice>A Cora admin still needs to assign your states before you can add contacts.</Notice></div>
      ) : null}
      {error ? <div className="mb-3"><Notice>{error}</Notice></div> : null}
      {tabs.length ? (
        <div className="glass mb-3 inline-flex max-w-full flex-wrap gap-1 rounded-full p-1" role="tablist" aria-label="State">
          {tabs.map((tab) => {
            const selected = filters.state === tab.id || (tab.id !== "" && sameState(filters.state, tab.id));
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  "h-9 rounded-full px-3.5 text-sm font-medium transition",
                  selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                )}
                onClick={() => { setFilters({ ...filters, state: tab.id, cities: [] }); setPage(1); }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Sort by"
          className={cn(pill, filters.mode && "border-primary")}
          value={filters.mode}
          onChange={(event) => chooseMode(event.target.value as SortMode)}
        >
          <option value="">Sort by</option>
          <option value="tags">Tags</option>
          <option value="visits">Visits</option>
          <option value="duplicates">Possible duplicates</option>
        </select>
        {filters.mode === "visits" ? (
          <select
            aria-label="Which visits"
            className={pill}
            value={filters.visited}
            onChange={(event) => { setFilters({ ...filters, visited: event.target.value }); setPage(1); }}
          >
            <option value={VISITED_ANY}>All visits</option>
            <option value={VISITED_NONE}>Not visited</option>
            {seasonChoices.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        ) : null}
        {filters.mode === "tags" ? (
          <select
            aria-label="Which tag"
            className={pill}
            value={filters.tag}
            onChange={(event) => {
              const tag = event.target.value;
              setFilters({ ...filters, tag, list: tag ? "main" : "tagged" });
              setPage(1);
            }}
          >
            <option value="">Any tag</option>
            {CONTACT_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        ) : null}
        {filters.state ? (
          <CityFilter
            choices={cityChoices}
            picked={filters.cities}
            onChange={(cities) => { setFilters({ ...filters, cities }); setPage(1); }}
          />
        ) : null}
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
        {selected.length && data.viewer.canEdit ? (
          <button type="button" className={`${pill} text-red-600`} onClick={() => setPendingDelete(selected)}>
            <Trash2 className="size-3.5" /> Delete {selected.length} contact{selected.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
      {filters.list === "tagged" ? <p className="mb-3 text-sm text-muted-foreground">Tagged contacts stay off the main list. Search still finds them from the main list.</p> : null}
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
                    <span>{household.latestVisited || "Not visited"}{household.visitCount > 1 ? ` · ${household.visitCount} visits` : household.visitCount === 1 ? " · 1 visit" : ""}</span>
                    <ReactionBadge reaction={household.latestReaction} />
                    {household.possibleDuplicate ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-900">Possible duplicate</span> : null}
                    <TagBadges tags={household.tags} />
                    {household.sharedWithCora ? null : <span className="text-xs">Private</span>}
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
                    {household.possibleDuplicate ? <span className="block text-[11px]">Possible duplicate</span> : null}
                  </td>
                  <td className="px-2"><ReactionBadge reaction={household.latestReaction} /></td>
                  <td className="px-2">
                    <button type="button" aria-label={`Delete ${household.name}`} disabled={!data.viewer.canEdit} className="text-muted-foreground hover:text-red-600 disabled:opacity-30" onClick={() => setPendingDelete([household.id])}>
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

function CityFilter({
  choices,
  picked,
  onChange,
}: {
  choices: { key: string; label: string; count: number }[];
  picked: string[];
  onChange: (cities: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const chosen = choices.filter((choice) => picked.includes(choice.key));
  const label = !picked.length ? "All cities" : chosen.length === 1 ? chosen[0].label : `${picked.length} cities`;
  const needle = search.trim().toLowerCase();
  const shown = needle ? choices.filter((choice) => choice.label.toLowerCase().includes(needle)) : choices;
  return (
    <Popover onOpenChange={(open) => { if (!open) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Cities" className={cn(pill, "max-w-[11rem]", picked.length && "border-primary")}>
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(18rem,calc(100vw-1.5rem))] p-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search cities"
          aria-label="Search cities"
          className="mb-2 h-9"
        />
        <button
          type="button"
          className={cn("mb-1 flex h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted", !picked.length && "font-semibold text-primary")}
          onClick={() => onChange([])}
        >
          All cities
        </button>
        <div className="max-h-64 overflow-y-auto">
          {shown.map((choice) => {
            const on = picked.includes(choice.key);
            return (
              <label key={choice.key || "__blank"} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                <Checkbox
                  checked={on}
                  onCheckedChange={(value) => onChange(value ? [...picked, choice.key] : picked.filter((key) => key !== choice.key))}
                />
                <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{choice.count}</span>
              </label>
            );
          })}
          {!shown.length ? <div className="px-2 py-2 text-sm text-muted-foreground">No cities</div> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const pill = "inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground transition hover:bg-muted active:scale-[0.98]";

function ReactionBadge({ reaction }: { reaction: HouseholdReaction | null }) {
  const meta = visitReactionMeta(reaction);
  if (!meta) return null;
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", meta.className)}>{meta.label}</span>;
}

function visitChipLabel(visit: HouseholdView["contactVisits"][number]) {
  const name = visit.visited.trim();
  const date = visit.visitDate ? formatMedium(visit.visitDate) : "";
  return name || date || "Visit";
}

function VisitChip({ visit }: { visit: HouseholdView["contactVisits"][number] }) {
  const meta = visitReactionMeta(visit.reaction);
  const label = visitChipLabel(visit);
  const full = visitNoteLabel(visit.visited, visit.visitDate, formatMedium);
  return (
    <span
      title={meta ? `${full} · ${meta.label}` : full}
      className={cn("inline-flex max-w-[8.5rem] shrink-0 items-center truncate rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap", meta ? meta.className : "bg-muted text-foreground")}
    >
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
              const meta = visitReactionMeta(visit.reaction);
              return (
                <div key={visit.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-foreground">{visitNoteLabel(visit.visited, visit.visitDate, formatMedium)}</span>
                  {meta ? <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.className)}>{meta.label}</span> : null}
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
        status: visit.status,
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
                      className={cn("rounded-full px-2.5 py-1 text-xs font-medium", (visit.status || "completed") === status ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}
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
          {data.viewer.role === "shliach" ? (
            <label className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm">
              <span>
                <span className="block font-medium text-foreground">Share with Cora</span>
                <span className="text-xs text-muted-foreground">Shared contacts also show on the Cora overview.</span>
              </span>
              <input type="checkbox" className="size-5 accent-primary" checked={form.sharedWithCora} onChange={(event) => setForm({ ...form, sharedWithCora: event.target.checked })} />
            </label>
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
                <p className="mt-2 text-sm text-amber-900">Possible duplicate{household.duplicateOfName ? ` · Might be the same as ${household.duplicateOfName}` : ""}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <ReactionBadge reaction={household.latestReaction} />
                <TagBadges tags={household.tags} />
                <span className="text-sm text-muted-foreground">{household.latestVisited || "Not visited"}{household.visitCount ? ` · ${household.visitCount} visit${household.visitCount === 1 ? "" : "s"}` : ""}</span>
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
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={pending}
                    onClick={() => start(async () => {
                      const result = await dismissDuplicateAction(household.id);
                      if (announce(result, "Not a duplicate")) onClose();
                    })}
                  >
                    Not a duplicate
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
                      <p className="text-xs text-mutedink">{visitStatusLabel(visit.status)}</p>
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
                  {reaction ? <p className="mt-2 text-xs">{reaction.label}</p> : null}
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
