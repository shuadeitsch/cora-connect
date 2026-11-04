"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONTACT_PROJECTS, FOCUS_STATES, UNSORTED_PROJECT, matchesStateFilter, projectLabel, sameState, stateLabel } from "@/lib/constants";
import { CONTACT_TAGS, matchesTagFilter, showInContactList } from "@/lib/contact-tags";
import { formatMedium } from "@/lib/format";
import { labeledVisitNotes } from "@/lib/visit-notes";
import { isRealVisit } from "@/lib/visited";
import type { AppData, HouseholdView } from "@/lib/types";
import { cn } from "@/lib/utils";

/* One set of contact filters for the Contacts page and the Map: state tabs, Sort by and its second menu, Cities. */

// Removed visits are already left out of contactVisits, so they never count.
export const VISITED_ANY = "__any_visit";
export const VISITED_NONE = "__not_visited";

export type SortMode = "" | "tags" | "visits" | "duplicates";

export const filterPill = "inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground transition hover:bg-muted active:scale-[0.98]";
const pill = filterPill;

/** One key per town, so "Portland", " portland " and "PORTLAND" are the same city. Blank is "". */
export function cityKey(city: string): string {
  return city.trim().replace(/\s+/g, " ").toLowerCase();
}

export const emptyFilters = {
  mode: "" as SortMode,
  state: "",
  cities: [] as string[],
  visited: "",
  tag: "",
  duplicates: false,
  list: "main" as "main" | "tagged",
};

export type ContactFilters = typeof emptyFilters;

export function stateTabs(data: AppData): { id: string; label: string }[] {
  if (data.viewer.role === "shliach") {
    const names = [...new Set(data.viewer.territory.map((row) => stateLabel(row.state)).filter(Boolean))];
    const tabs = names.map((name) => ({ id: name, label: name }));
    if (tabs.length > 1) return [{ id: "", label: "All states" }, ...tabs];
    return tabs;
  }
  return [{ id: "", label: "All states" }, ...FOCUS_STATES.map((state) => ({ id: state.name, label: state.name }))];
}

export function initialState(data: AppData) {
  const tabs = stateTabs(data);
  if (data.viewer.role === "shliach" && tabs.length === 1) return tabs[0]?.id ?? "";
  return "";
}

export function useContactFilters(data: AppData, query: string, gone: string[] = []) {
  const [filters, setFilters] = useState<ContactFilters>(() => ({ ...emptyFilters, state: initialState(data) }));

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
        const visits = household.contactVisits ?? [];
        const hit = visits.some((visit) => isRealVisit(visit.visited) && projectLabel(visit.visited) === filters.visited);
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

  const matched: HouseholdView[] = useMemo(() => {
    const picked = new Set(filters.cities);
    return picked.size ? beforeCity.filter((household) => picked.has(cityKey(household.city))) : [...beforeCity];
  }, [beforeCity, filters.cities]);

  // Visits are grouped as Summer 5786, Chanukah 5787, or Unsorted (any other or old value).
  const seasonChoices: string[] = [...CONTACT_PROJECTS, UNSORTED_PROJECT];

  function chooseMode(mode: SortMode) {
    const base = { ...emptyFilters, state: filters.state, cities: filters.cities, mode };
    if (mode === "tags") setFilters({ ...base, list: "tagged" });
    else if (mode === "duplicates") setFilters({ ...base, duplicates: true });
    else if (mode === "visits") setFilters({ ...base, visited: VISITED_ANY });
    else setFilters(base);
  }

  function resetFilters() {
    setFilters({ ...emptyFilters, state: initialState(data) });
  }

  return { filters, setFilters, tabs: stateTabs(data), beforeCity, cityChoices, matched, seasonChoices, chooseMode, resetFilters };
}

export type ContactFilterState = ReturnType<typeof useContactFilters>;

export function ContactStateTabs({ ctl, onChange, className }: { ctl: ContactFilterState; onChange?: () => void; className?: string }) {
  const { filters, setFilters, tabs } = ctl;
  if (!tabs.length) return null;
  return (
    <div className={cn("glass inline-flex max-w-full flex-wrap gap-1 rounded-full p-1", className)} role="tablist" aria-label="State">
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
            onClick={() => { setFilters({ ...filters, state: tab.id, cities: [] }); onChange?.(); }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Sort by, its second menu, and Cities when a state is picked. */
export function ContactFilterControls({ ctl, onChange }: { ctl: ContactFilterState; onChange?: () => void }) {
  const { filters, setFilters, chooseMode, seasonChoices, cityChoices } = ctl;
  return (
    <>
      <select
        aria-label="Sort by"
        className={cn(pill, filters.mode && "border-primary")}
        value={filters.mode}
        onChange={(event) => { chooseMode(event.target.value as SortMode); onChange?.(); }}
      >
        <option value="">All</option>
        <option value="tags">Tags</option>
        <option value="visits">Visits</option>
        <option value="duplicates">Possible duplicates</option>
      </select>
      {filters.mode === "visits" ? (
        <select
          aria-label="Which visits"
          className={pill}
          value={filters.visited}
          onChange={(event) => { setFilters({ ...filters, visited: event.target.value }); onChange?.(); }}
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
            onChange?.();
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
          onChange={(cities) => { setFilters({ ...filters, cities }); onChange?.(); }}
        />
      ) : null}
    </>
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

