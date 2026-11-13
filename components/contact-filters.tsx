"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ListFilter } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONTACT_PROJECTS, FOCUS_STATES, UNSORTED_PROJECT, matchesStateFilter, sameState, stateLabel } from "@/lib/constants";
import { CONTACT_TAGS, matchesTagFilter, showInContactList } from "@/lib/contact-tags";
import { contactHasEmail, contactHasPhone, matchesVisitStatusFilters } from "@/lib/contact-match";
import { formatMedium } from "@/lib/format";
import { labeledVisitNotes } from "@/lib/visit-notes";
import { extraAddressSearchText } from "@/lib/extra-addresses";
import { compareVisitStatusGroup } from "@/lib/visit-status";
import type { AppData, HouseholdView } from "@/lib/types";
import { cn } from "@/lib/utils";

/* One set of contact filters for the Contacts page and the Map: state tabs, Sort by and its second menu, Cities. */

// Removed visits are already left out of contactVisits, so they never count.
export const VISITED_ANY = "__any_visit";
export const VISITED_NONE = "__not_visited";

export type SortMode = "" | "tags" | "visits" | "duplicates" | "shliach-deleted";

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
  seasons: [] as string[],
  tag: "",
  tagsOn: false,
  duplicates: false,
  shliachDeleted: false,
  hasEmail: false,
  hasPhone: false,
  visitCompleted: false,
  visitDeferred: false,
  visitNotVisited: false,
  list: "main" as "main" | "tagged" | "shliach-deleted",
};

export type ContactFilters = typeof emptyFilters;

export function withDerivedFilters(filters: ContactFilters): ContactFilters {
  const list: ContactFilters["list"] = filters.shliachDeleted ? "shliach-deleted" : filters.tagsOn ? "tagged" : "main";
  let mode: SortMode = "";
  if (filters.shliachDeleted) mode = "shliach-deleted";
  else if (filters.duplicates) mode = "duplicates";
  else if (filters.tagsOn) mode = "tags";
  else if (filters.visitCompleted || filters.visitDeferred || filters.visitNotVisited || filters.seasons.length) mode = "visits";
  return { ...filters, list, mode };
}

export function filtersActive(filters: ContactFilters): boolean {
  return Boolean(
    filters.hasEmail
    || filters.hasPhone
    || filters.visitCompleted
    || filters.visitDeferred
    || filters.visitNotVisited
    || filters.tagsOn
    || filters.tag
    || filters.duplicates
    || filters.shliachDeleted
    || filters.seasons.length
    || filters.cities.length,
  );
}


export function stateFilterActive(filters: ContactFilters, tabs: { id: string }[]): boolean {
  return tabs.length > 1 && Boolean(filters.state);
}

export function activeFilterCount(filters: ContactFilters, isAdmin: boolean, tabs: { id: string }[]): number {
  return activeFilterChips(filters, isAdmin).length + (stateFilterActive(filters, tabs) ? 1 : 0);
}

export function activeFilterChips(filters: ContactFilters, isAdmin: boolean, tabs: { id: string; label: string }[] = []): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  if (stateFilterActive(filters, tabs)) {
    const tab = tabs.find((item) => item.id === filters.state);
    chips.push({ key: "state", label: tab?.label || filters.state });
  }
  if (filters.hasEmail) chips.push({ key: "hasEmail", label: "Has email" });
  if (filters.hasPhone) chips.push({ key: "hasPhone", label: "Has phone" });
  if (filters.visitCompleted) chips.push({ key: "visitCompleted", label: "Completed" });
  if (filters.visitDeferred) chips.push({ key: "visitDeferred", label: "Deferred" });
  if (filters.visitNotVisited) chips.push({ key: "visitNotVisited", label: "Not visited" });
  for (const season of filters.seasons) chips.push({ key: `season:${season}`, label: season });
  if (filters.tagsOn) chips.push({ key: "tagsOn", label: filters.tag || "Tags" });
  if (filters.duplicates) chips.push({ key: "duplicates", label: "Possible duplicates" });
  if (isAdmin && filters.shliachDeleted) chips.push({ key: "shliachDeleted", label: "Deleted by shliach" });
  if (filters.cities.length) chips.push({ key: "cities", label: filters.cities.length === 1 ? "1 city" : `${filters.cities.length} cities` });
  return chips;
}

export function clearActiveFilter(filters: ContactFilters, key: string): ContactFilters {
  if (key === "hasEmail") return withDerivedFilters({ ...filters, hasEmail: false });
  if (key === "hasPhone") return withDerivedFilters({ ...filters, hasPhone: false });
  if (key === "visitCompleted") return withDerivedFilters({ ...filters, visitCompleted: false });
  if (key === "visitDeferred") return withDerivedFilters({ ...filters, visitDeferred: false });
  if (key === "visitNotVisited") return withDerivedFilters({ ...filters, visitNotVisited: false });
  if (key === "tagsOn") return withDerivedFilters({ ...filters, tagsOn: false, tag: "" });
  if (key === "duplicates") return withDerivedFilters({ ...filters, duplicates: false });
  if (key === "shliachDeleted") return withDerivedFilters({ ...filters, shliachDeleted: false });
  if (key === "cities") return withDerivedFilters({ ...filters, cities: [] });
  if (key === "state") return withDerivedFilters({ ...filters, state: "", cities: [] });
  if (key.startsWith("season:")) {
    const season = key.slice(7);
    return withDerivedFilters({ ...filters, seasons: filters.seasons.filter((item) => item !== season) });
  }
  return filters;
}

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

export function useContactFilters(data: AppData, query: string, gone: string[] = [], initialMode: SortMode | "" = "") {
  const [filters, setFilters] = useState<ContactFilters>(() => ({
    ...emptyFilters,
    state: initialState(data),
    ...(initialMode === "duplicates" ? withDerivedFilters({ ...emptyFilters, state: initialState(data), duplicates: true }) : {}),
  }));

  // Everything the filters allow except the city choice, so the Cities counts match what picking a city shows.
  const beforeCity = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.households.filter((household) => {
      if (gone.includes(household.id)) return false;
      const noteHay = data.viewer.canViewHistory
        ? labeledVisitNotes(household.notes, household.contactVisits ?? [], formatMedium).map((note) => `${note.label} ${note.notes}`).join(" ")
        : "";
      const extraHay = extraAddressSearchText(household.extraAddresses);
      const hay = `${household.name} ${household.city} ${household.state} ${household.zip} ${extraHay} ${household.tags.join(" ")} ${household.projectName ?? ""} ${noteHay} ${household.people.map((person) => `${person.name} ${person.phone} ${person.phone2} ${person.phone3} ${person.email}`).join(" ")}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (filters.shliachDeleted) {
        if (!household.deletedByShliachAt) return false;
      } else if (household.deletedByShliachAt && data.viewer.role === "admin") {
        // Soft-hidden contacts stay off the main admin list unless the filter is on.
        return false;
      }
      if (filters.tagsOn) {
        if (filters.tag) {
          if (!matchesTagFilter(household.tags, filters.tag)) return false;
        } else if (!showInContactList(household.tags, q, "tagged")) return false;
      } else if (!showInContactList(household.tags, q, "main")) return false;
      if (filters.state && !matchesStateFilter(household.state, filters.state) && !(household.extraAddresses ?? []).some((address) => matchesStateFilter(address.state, filters.state))) return false;
      if (filters.hasEmail && !contactHasEmail(household)) return false;
      if (filters.hasPhone && !contactHasPhone(household)) return false;
      if (!matchesVisitStatusFilters(household.contactVisits, {
        visitCompleted: filters.visitCompleted,
        visitDeferred: filters.visitDeferred,
        visitNotVisited: filters.visitNotVisited,
        seasons: filters.seasons,
      })) return false;
      if (filters.duplicates && !household.possibleDuplicate) return false;
      return true;
    });
  }, [data.households, data.viewer.canViewHistory, data.viewer.role, query, filters.tag, filters.tagsOn, filters.shliachDeleted, filters.state, filters.hasEmail, filters.hasPhone, filters.visitCompleted, filters.visitDeferred, filters.visitNotVisited, filters.seasons, filters.duplicates, gone]);

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
    const rows = picked.size
      ? beforeCity.filter((household) => picked.has(cityKey(household.city)) || (household.extraAddresses ?? []).some((address) => picked.has(cityKey(address.city))))
      : [...beforeCity];
    const visitOn = filters.visitCompleted || filters.visitDeferred || filters.visitNotVisited || filters.seasons.length;
    if (visitOn) {
      rows.sort((a, b) => compareVisitStatusGroup(a, b, filters.seasons) || a.name.localeCompare(b.name));
    }
    return rows;
  }, [beforeCity, filters.cities, filters.visitCompleted, filters.visitDeferred, filters.visitNotVisited, filters.seasons]);

  // Visits are grouped as Summer 5786, Chanukah 5787, or Unsorted (any other or old value).
  const seasonChoices: string[] = [...CONTACT_PROJECTS, UNSORTED_PROJECT];

  function chooseMode(mode: SortMode) {
    // Kept for older callers. New filters are toggled independently and do not clear each other.
    if (mode === "tags") setFilters((current) => withDerivedFilters({ ...current, tagsOn: true }));
    else if (mode === "duplicates") setFilters((current) => withDerivedFilters({ ...current, duplicates: true }));
    else if (mode === "visits") setFilters((current) => withDerivedFilters({ ...current, visitCompleted: true, visitDeferred: true }));
    else if (mode === "shliach-deleted") setFilters((current) => withDerivedFilters({ ...current, shliachDeleted: true }));
    else setFilters((current) => withDerivedFilters({ ...emptyFilters, state: current.state, cities: current.cities }));
  }

  function toggle<K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) {
    setFilters((current) => withDerivedFilters({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters((current) => withDerivedFilters({ ...emptyFilters, state: current.state }));
  }

  function resetFilters() {
    setFilters({ ...emptyFilters, state: initialState(data) });
  }

  return { filters, setFilters, tabs: stateTabs(data), beforeCity, cityChoices, matched, seasonChoices, chooseMode, resetFilters, clearFilters, toggle, isAdmin: data.viewer.role === "admin" };
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

function FilterToggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      className={cn(pill, on && "border-primary bg-primary text-primary-foreground")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}


function usePhoneLayout() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const apply = () => setPhone(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return phone;
}

function FilterCheck({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1 text-sm text-foreground hover:bg-muted/80">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} aria-label={label} />
      <span>{label}</span>
    </label>
  );
}

function FilterPanelBody({ ctl, onChange, onDone }: { ctl: ContactFilterState; onChange?: () => void; onDone: () => void }) {
  const { filters, setFilters, seasonChoices, cityChoices, tabs } = ctl;
  function set(patch: Partial<ContactFilters>) {
    setFilters(withDerivedFilters({ ...filters, ...patch }));
    onChange?.();
  }
  const count = activeFilterCount(filters, ctl.isAdmin, tabs);
  return (
    <div className="flex max-h-[min(70vh,36rem)] flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
        {tabs.length > 1 ? (
          <fieldset className="grid gap-0.5">
            <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">State</legend>
            <FilterCheck checked={filters.state === ""} label="All states" onChange={(on) => { if (on) set({ state: "", cities: [] }); }} />
            {tabs.filter((tab) => tab.id).map((tab) => (
              <FilterCheck
                key={tab.id}
                checked={filters.state === tab.id}
                label={tab.label}
                onChange={(on) => set({ state: on ? tab.id : "", cities: [] })}
              />
            ))}
          </fieldset>
        ) : null}
        <fieldset className="grid gap-0.5">
          <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Visit status</legend>
          <FilterCheck checked={filters.visitCompleted} label="Completed" onChange={(on) => set({ visitCompleted: on })} />
          <FilterCheck checked={filters.visitDeferred} label="Deferred" onChange={(on) => set({ visitDeferred: on })} />
          <FilterCheck checked={filters.visitNotVisited} label="Not visited" onChange={(on) => set({ visitNotVisited: on })} />
        </fieldset>
        <fieldset className="grid gap-0.5">
          <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Contact info</legend>
          <FilterCheck checked={filters.hasEmail} label="Has email" onChange={(on) => set({ hasEmail: on })} />
          <FilterCheck checked={filters.hasPhone} label="Has phone" onChange={(on) => set({ hasPhone: on })} />
        </fieldset>
        <fieldset className="grid gap-0.5">
          <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Project / season</legend>
          {seasonChoices.map((season) => (
            <FilterCheck
              key={season}
              checked={filters.seasons.includes(season)}
              label={season}
              onChange={(on) => set({ seasons: on ? [...filters.seasons, season] : filters.seasons.filter((item) => item !== season) })}
            />
          ))}
        </fieldset>
        <fieldset className="grid gap-0.5">
          <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Tags</legend>
          <FilterCheck checked={filters.tagsOn} label="Tagged contacts" onChange={(on) => set({ tagsOn: on, tag: on ? filters.tag : "" })} />
          {filters.tagsOn ? (
            <>
              <FilterCheck checked={!filters.tag} label="Any tag" onChange={(on) => { if (on) set({ tag: "" }); }} />
              {CONTACT_TAGS.map((tag) => (
                <FilterCheck key={tag} checked={filters.tag === tag} label={tag} onChange={(on) => set({ tag: on ? tag : "" })} />
              ))}
            </>
          ) : null}
        </fieldset>
        <fieldset className="grid gap-0.5">
          <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Other</legend>
          <FilterCheck checked={filters.duplicates} label="Possible duplicates" onChange={(on) => set({ duplicates: on })} />
          {ctl.isAdmin ? (
            <FilterCheck checked={filters.shliachDeleted} label="Deleted by shliach" onChange={(on) => set({ shliachDeleted: on })} />
          ) : null}
        </fieldset>
        {filters.state && cityChoices.length ? (
          <fieldset className="grid gap-0.5">
            <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Cities</legend>
            {cityChoices.map((city) => (
              <FilterCheck
                key={city.key}
                checked={filters.cities.includes(city.key)}
                label={`${city.label} (${city.count})`}
                onChange={(on) => set({ cities: on ? [...filters.cities, city.key] : filters.cities.filter((item) => item !== city.key) })}
              />
            ))}
          </fieldset>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <button type="button" className={cn(pill, "min-h-11")} onClick={onDone}>Done</button>
        <button
          type="button"
          className={cn(pill, "min-h-11")}
          disabled={!count}
          onClick={() => { ctl.clearFilters(); onChange?.(); }}
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

/** One Filters control. Checkboxes stay open while ticking; closes on outside tap, Done, or Esc. Phones use a bottom sheet. */
export function ContactFilterControls({ ctl, onChange }: { ctl: ContactFilterState; onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const phone = usePhoneLayout();
  const count = activeFilterCount(ctl.filters, ctl.isAdmin, ctl.tabs);
  const trigger = (
    <button
      type="button"
      className={cn(pill, count > 0 && "border-primary bg-primary/10")}
      aria-label={count ? `Filters, ${count} active` : "Filters"}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      <ListFilter className="size-3.5" />
      Filters
      {count ? (
        <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
  if (phone) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl p-4" aria-describedby={undefined}>
            <SheetHeader className="mb-2 text-left">
              <SheetTitle className="font-heading text-foreground">Filters</SheetTitle>
            </SheetHeader>
            <FilterPanelBody ctl={ctl} onChange={onChange} onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(pill, count > 0 && "border-primary bg-primary/10")}
          aria-label={count ? `Filters, ${count} active` : "Filters"}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <ListFilter className="size-3.5" />
          Filters
          {count ? (
            <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(22rem,calc(100vw-1.5rem))] p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <p className="mb-2 font-heading text-sm font-semibold text-foreground">Filters</p>
        <FilterPanelBody ctl={ctl} onChange={onChange} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}


export function ActiveFilterChips({ ctl, onChange }: { ctl: ContactFilterState; onChange?: () => void }) {
  const chips = activeFilterChips(ctl.filters, ctl.isAdmin);
  if (!chips.length) return null;
  return (
    <div className="mb-3 flex w-full flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={cn(pill, "border-primary bg-primary/10 pr-2")}
          aria-label={`Clear ${chip.label}`}
          onClick={() => { ctl.setFilters(clearActiveFilter(ctl.filters, chip.key)); onChange?.(); }}
        >
          {chip.label}
          <span aria-hidden="true" className="text-muted-foreground">×</span>
        </button>
      ))}
      <button
        type="button"
        className={pill}
        onClick={() => { ctl.clearFilters(); onChange?.(); }}
      >
        Clear filters
      </button>
    </div>
  );
}

function SeasonFilter({
  choices,
  picked,
  onChange,
}: {
  choices: string[];
  picked: string[];
  onChange: (seasons: string[]) => void;
}) {
  const label = !picked.length ? "Seasons" : picked.length === 1 ? picked[0] : `${picked.length} seasons`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Seasons" className={cn(pill, "max-w-[11rem]", picked.length && "border-primary bg-primary text-primary-foreground")}>
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(16rem,calc(100vw-1.5rem))] p-2">
        <button
          type="button"
          className={cn("mb-1 flex h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted", !picked.length && "font-semibold text-primary")}
          onClick={() => onChange([])}
        >
          Any season
        </button>
        <div className="max-h-64 overflow-y-auto">
          {choices.map((name) => {
            const on = picked.includes(name);
            return (
              <label key={name} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                <Checkbox
                  checked={on}
                  onCheckedChange={(value) => onChange(value ? [...picked, name] : picked.filter((item) => item !== name))}
                />
                <span className="min-w-0 flex-1 truncate">{name}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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

