"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BoxSelect,
  Ellipsis,
  List,
  MousePointerClick,
  Undo2,
  X,
} from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";
import { useIsPhone } from "@/lib/use-phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MapPin } from "@/components/map-canvas";
import {
  ContactFilterControls,
  ContactStateTabs,
  filterPill,
  useContactFilters,
} from "@/components/contact-filters";
import { CreateRouteDialog } from "@/components/create-route";
import { useMapPoints } from "@/components/map-points";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(
  () => import("@/components/map-canvas").then((mod) => mod.MapCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);

const noop = () => {};

/** Pick stops on the map: tap pins, or drag a box around several, then name and save the route. */
export function RouteBuilder({ data }: { data: AppData }) {
  const [query, setQuery] = useState("");
  const ctl = useContactFilters(data, query);
  const { pointFor, busy } = useMapPoints(data.households);
  const [picked, setPickedState] = useState<string[]>([]);
  const pickedRef = useRef<string[]>([]);
  const [history, setHistory] = useState<string[][]>([]);
  const phone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetList, setSheetList] = useState(false);
  const [hintHidden, setHintHidden] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setHintHidden({
        pins: localStorage.getItem("cora.hint.pins") === "1",
        box: localStorage.getItem("cora.hint.box") === "1",
      });
    } catch {}
  }, []);

  /** Every change to the selection goes through here so Undo last can step back. */
  function setPicked(update: string[] | ((current: string[]) => string[])) {
    const current = pickedRef.current;
    const next = typeof update === "function" ? update(current) : update;
    if (
      next.length === current.length &&
      next.every((id, index) => id === current[index])
    )
      return;
    pickedRef.current = next;
    setHistory((items) => [...items.slice(-49), current]);
    setPickedState(next);
  }
  function undo() {
    setHistory((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      pickedRef.current = previous;
      setPickedState(previous);
      return items.slice(0, -1);
    });
  }
  function hint(mode: "pins" | "box", hidden: boolean) {
    setHintHidden((current) => ({ ...current, [mode]: hidden }));
    try {
      if (hidden) localStorage.setItem(`cora.hint.${mode}`, "1");
      else localStorage.removeItem(`cora.hint.${mode}`);
    } catch {}
  }
  const [boxMode, setBoxMode] = useState(false);
  const [naming, setNaming] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  useEffect(() => {
    // The contact list starts open on wide screens, where it fits beside the map.
    if (window.matchMedia("(min-width: 1024px)").matches) setListOpen(true);
  }, []);

  const shown = ctl.matched.filter((household) => pointFor(household));
  const pins: MapPin[] = shown.map((household) => {
    const point = pointFor(household)!;
    return {
      id: household.id,
      name: household.name,
      address: household.address,
      lat: point.lat,
      lng: point.lng,
      due:
        household.dueState === "overdue"
          ? "overdue"
          : household.dueState === "due"
            ? "due"
            : "ok",
      schedule: household.scheduleName,
    };
  });
  const allShownPicked =
    shown.length > 0 &&
    shown.every((household) => picked.includes(household.id));

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleShown() {
    setPicked((current) =>
      allShownPicked
        ? current.filter(
            (id) => !shown.some((household) => household.id === id),
          )
        : [
            ...current,
            ...shown
              .map((household) => household.id)
              .filter((id) => !current.includes(id)),
          ],
    );
  }

  const map = (
    <MapCanvas
      pins={pins}
      selected={picked}
      numbers={{}}
      start={
        data.org.startLat != null && data.org.startLng != null
          ? { lat: data.org.startLat, lng: data.org.startLng }
          : null
      }
      routeLine={[]}
      onOpen={noop}
      onVisit={noop}
      pickMode
      onPick={toggle}
      boxMode={boxMode}
      onBox={(ids) =>
        setPicked((current) => [
          ...current,
          ...ids.filter((id) => !current.includes(id)),
        ])
      }
    />
  );
  const listItems = (
    <>
      {shown.map((household) => {
        const on = picked.includes(household.id);
        return (
          <li key={household.id}>
            <label
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5",
                on && "bg-primary/5",
              )}
            >
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-[#0f766e]"
                checked={on}
                onChange={() => toggle(household.id)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {household.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {household.address}
                </span>
              </span>
            </label>
          </li>
        );
      })}
      {!shown.length ? (
        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
          {busy ? "Finding addresses…" : "No contacts on the map."}
        </li>
      ) : null}
    </>
  );
  const filtersUnset =
    !ctl.filters.mode && !ctl.filters.cities.length && !query;
  const createDialog = (
    <CreateRouteDialog
      data={data}
      ids={picked}
      open={naming}
      onClose={() => setNaming(false)}
    />
  );

  if (phone) {
    const mode = boxMode ? "box" : "pins";
    const pickMode = (box: boolean, close = false) => {
      setBoxMode(box);
      if (close) setSheetOpen(false);
    };
    return (
      <div className="phone-map fixed inset-0 z-[45] isolate bg-background">
        {map}
        <div className="pointer-events-none absolute inset-0 z-[500]">
          <div className="flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <Link
              href="/saved-routes"
              aria-label="Back to routes"
              className="glass pointer-events-auto inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              {!hintHidden[mode] ? (
                <div
                  className="glass pointer-events-auto flex h-11 max-w-full items-center gap-1 rounded-full pl-4 pr-1 text-sm text-foreground"
                  aria-live="polite"
                >
                  <span className="truncate">
                    {boxMode
                      ? "Drag on the map to draw a box"
                      : "Tap pins to add or remove"}
                  </span>
                  <button
                    type="button"
                    aria-label="Hide hint"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                    onClick={() => hint(mode, true)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : null}
              {busy ? (
                <span className="glass rounded-full px-3 py-2 text-xs text-muted-foreground">
                  Finding addresses…
                </span>
              ) : null}
            </div>
          </div>
          <div className="glass pointer-events-auto absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-1.5 rounded-full p-1.5">
            <div
              role="group"
              aria-label="How to select"
              className="inline-flex shrink-0 rounded-full bg-muted p-0.5"
            >
              <button
                type="button"
                aria-label="Tap pins"
                aria-pressed={!boxMode}
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-full",
                  !boxMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground",
                )}
                onClick={() => pickMode(false)}
              >
                <MousePointerClick className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Draw box"
                aria-pressed={boxMode}
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-full",
                  boxMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground",
                )}
                onClick={() => pickMode(true)}
              >
                <BoxSelect className="size-5" />
              </button>
            </div>
            <span
              className="min-w-0 flex-1 truncate px-1 text-sm text-foreground"
              aria-live="polite"
            >
              <b className="font-semibold">{picked.length}</b> selected
            </span>
            {picked.length ? (
              <Button
                className="h-11 shrink-0 rounded-full px-4 text-sm"
                onClick={() => setNaming(true)}
              >
                Create route
              </Button>
            ) : null}
            <button
              type="button"
              aria-label="More options"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground"
              onClick={() => setSheetOpen(true)}
            >
              <Ellipsis className="size-5" />
            </button>
          </div>
        </div>
        <BottomSheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) setSheetList(false);
          }}
          title={
            sheetList ? `Contacts on the map (${shown.length})` : "Options"
          }
        >
          {sheetList ? (
            <div className="grid gap-2">
              <button
                type="button"
                className={cn(filterPill, "h-11 justify-self-start")}
                onClick={() => setSheetList(false)}
              >
                <ArrowLeft className="size-4" /> Options
              </button>
              <ul
                aria-label="Contacts on the map"
                className="divide-y rounded-2xl border bg-card [&_label]:min-h-12"
              >
                {listItems}
              </ul>
            </div>
          ) : (
            <div className="grid gap-4 pb-1">
              <section
                className="grid grid-cols-2 gap-2"
                aria-label="How to select"
              >
                <button
                  type="button"
                  aria-pressed={!boxMode}
                  className={cn(
                    filterPill,
                    "h-12 justify-center",
                    !boxMode &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  onClick={() => pickMode(false, true)}
                >
                  <MousePointerClick className="size-5" /> Tap pins
                </button>
                <button
                  type="button"
                  aria-pressed={boxMode}
                  className={cn(
                    filterPill,
                    "h-12 justify-center",
                    boxMode &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  onClick={() => pickMode(true, true)}
                >
                  <BoxSelect className="size-5" /> Draw box
                </button>
              </section>
              <section className="grid gap-2" aria-label="Filters">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search contacts"
                  aria-label="Search contacts"
                  className="h-11 rounded-full bg-card text-base"
                />
                <div className="flex flex-wrap items-center gap-2 [&_select]:h-11 [&_[role=tab]]:h-11 [&>button]:h-11">
                  <ContactStateTabs ctl={ctl} />
                  <ContactFilterControls ctl={ctl} />
                  <button
                    type="button"
                    className={cn(
                      filterPill,
                      filtersUnset && "bg-primary text-primary-foreground",
                    )}
                    onClick={() => {
                      ctl.resetFilters();
                      setQuery("");
                    }}
                  >
                    All contacts
                  </button>
                </div>
              </section>
              <section
                className="grid grid-cols-2 gap-2"
                aria-label="Selection"
              >
                <button
                  type="button"
                  className={cn(filterPill, "h-11 justify-center")}
                  onClick={() => setSheetList(true)}
                >
                  <List className="size-4" /> List ({shown.length})
                </button>
                <button
                  type="button"
                  className={cn(filterPill, "h-11 justify-center")}
                  disabled={!shown.length}
                  onClick={toggleShown}
                >
                  {allShownPicked
                    ? "Unselect shown"
                    : `Select shown (${shown.length})`}
                </button>
                <button
                  type="button"
                  className={cn(
                    filterPill,
                    "h-11 justify-center disabled:opacity-50",
                  )}
                  disabled={!history.length}
                  onClick={undo}
                >
                  <Undo2 className="size-4" /> Undo last
                </button>
                <button
                  type="button"
                  className={cn(
                    filterPill,
                    "h-11 justify-center disabled:opacity-50",
                  )}
                  disabled={!picked.length}
                  onClick={() => setPicked([])}
                >
                  <X className="size-4" /> Clear selection
                </button>
              </section>
              <button
                type="button"
                className={cn(filterPill, "h-11 justify-center")}
                onClick={() => {
                  hint("pins", false);
                  hint("box", false);
                  setSheetOpen(false);
                }}
              >
                Show hints
              </button>
            </div>
          )}
        </BottomSheet>
        {createDialog}
      </div>
    );
  }

  return (
    <div className="relative isolate h-full min-h-[70dvh]">
      {map}
      <div className="pointer-events-none absolute inset-0 z-[500]">
        <div className="pointer-events-auto m-3 flex flex-wrap items-center gap-2">
          <Link
            href="/saved-routes"
            className={filterPill}
            aria-label="Back to routes"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <ContactStateTabs ctl={ctl} />
          <ContactFilterControls ctl={ctl} />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search contacts"
            aria-label="Search contacts"
            className="h-10 w-44 rounded-full bg-card"
          />
          <button
            type="button"
            className={cn(
              filterPill,
              !ctl.filters.mode &&
                !ctl.filters.cities.length &&
                !query &&
                "bg-primary text-primary-foreground",
            )}
            onClick={() => {
              ctl.resetFilters();
              setQuery("");
            }}
          >
            All contacts
          </button>
          {busy ? (
            <span className="glass rounded-full px-3 py-2 text-xs text-muted-foreground">
              Finding addresses…
            </span>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-x-3 top-[38%] bottom-24 flex flex-col items-stretch justify-end gap-2 lg:inset-x-auto lg:top-20 lg:right-4 lg:bottom-4 lg:items-end">
          {listOpen ? (
            <aside
              aria-label="Contacts on the map"
              className="glass pointer-events-auto flex min-h-0 flex-1 flex-col rounded-3xl p-2 lg:w-80"
            >
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-sm font-semibold text-foreground">
                  Contacts ({shown.length})
                </p>
                <button
                  type="button"
                  aria-label="Close list"
                  className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"
                  onClick={() => setListOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
              <ul className="flex-1 divide-y overflow-auto rounded-2xl bg-card">
                {listItems}
              </ul>
            </aside>
          ) : null}
          <div className="glass pointer-events-auto flex shrink-0 flex-wrap items-center gap-2 rounded-3xl p-2">
            <span className="px-2 text-sm font-semibold text-foreground">
              {picked.length} selected
            </span>
            <span
              className="basis-full px-2 text-xs text-muted-foreground lg:order-last"
              aria-live="polite"
            >
              {boxMode
                ? "Drag on the map to draw a box. Each box adds more."
                : "Tap pins to add them. Tap again to remove."}
            </span>
            <div
              role="group"
              aria-label="How to select"
              className="inline-flex rounded-full bg-muted p-0.5"
            >
              <button
                type="button"
                aria-pressed={!boxMode}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
                  !boxMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground",
                )}
                onClick={() => setBoxMode(false)}
              >
                <MousePointerClick className="size-4" /> Click pins
              </button>
              <button
                type="button"
                aria-pressed={boxMode}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
                  boxMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground",
                )}
                onClick={() => setBoxMode(true)}
              >
                <BoxSelect className="size-4" /> Draw box
              </button>
            </div>
            <button
              type="button"
              className={cn(filterPill, "h-9")}
              disabled={!shown.length}
              onClick={toggleShown}
            >
              {allShownPicked
                ? "Unselect shown"
                : `Select shown (${shown.length})`}
            </button>
            <button
              type="button"
              aria-pressed={listOpen}
              className={cn(
                filterPill,
                "h-9",
                listOpen && "bg-primary text-primary-foreground",
              )}
              onClick={() => setListOpen((open) => !open)}
            >
              <List className="size-4" /> List
            </button>
            {picked.length ? (
              <button
                type="button"
                className={cn(filterPill, "h-9")}
                onClick={() => setPicked([])}
              >
                Clear
              </button>
            ) : null}
            <Button
              className="h-9 rounded-full"
              disabled={!picked.length}
              onClick={() => setNaming(true)}
            >
              Create route
            </Button>
          </div>
        </div>
      </div>
      {createDialog}
    </div>
  );
}
