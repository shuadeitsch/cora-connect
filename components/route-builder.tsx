"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BoxSelect, List, MousePointerClick, X } from "lucide-react";
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
  const [picked, setPicked] = useState<string[]>([]);
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

  return (
    <div className="relative h-full min-h-[70dvh]">
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
              onClick={() =>
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
                )
              }
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
      <CreateRouteDialog
        data={data}
        ids={picked}
        open={naming}
        onClose={() => setNaming(false)}
      />
    </div>
  );
}
