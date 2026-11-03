"use client";

import { AddressLink } from "@/components/address-link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MapPin } from "@/components/map-canvas";
import { useMapPoints } from "@/components/map-points";
import { ContactFilterControls, ContactStateTabs, filterPill, useContactFilters } from "@/components/contact-filters";
import { cn } from "@/lib/utils";
import type { AppData, HouseholdView } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map-canvas").then((mod) => mod.MapCanvas), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

export function MapView({ data }: { data: AppData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const filterCtl = useContactFilters(data, query);
  const { pointFor, busy: locating } = useMapPoints(data.households);
  const [activeRoute, setActiveRoute] = useState("");
  const [routesOpen, setRoutesOpen] = useState(false);
  const [contactId, setContactId] = useState("");

  const matched = filterCtl.matched;
  const filtered = matched.filter((household) => pointFor(household));
  const unplaced = matched.length - filtered.length;

  const active = data.routes.find((route) => route.id === activeRoute);
  const line = active
    ? active.stops.flatMap((stop) => (stop.lat != null && stop.lng != null ? [{ lat: stop.lat, lng: stop.lng }] : []))
    : [];

  const numbers: Record<string, number> = {};
  (active ? active.stops.map((stop) => stop.householdId) : []).forEach((id, index) => {
    numbers[id] = index + 1;
  });

  const pins: MapPin[] = filtered.map((household) => ({
    id: household.id,
    name: household.name,
    address: household.address,
    lat: pointFor(household)!.lat,
    lng: pointFor(household)!.lng,
    due: household.dueState === "overdue" ? "overdue" : household.dueState === "due" ? "due" : "ok",
    schedule: household.scheduleName,
  }));

  const contact = data.households.find((household) => household.id === contactId) ?? null;

  return (
    <div className="relative isolate h-full min-h-[70dvh]">
      <MapCanvas
        pins={pins}
        selected={[]}
        numbers={numbers}
        start={data.org.startLat != null && data.org.startLng != null ? { lat: data.org.startLat, lng: data.org.startLng } : null}
        routeLine={line}
        onOpen={setContactId}
        onVisit={(id) => router.push(`/reports?new=1&household=${id}`)}
      />
      <div className="pointer-events-none absolute inset-0 z-[500]">
        <div className="pointer-events-auto m-3 flex flex-wrap items-center gap-2">
          <ContactStateTabs ctl={filterCtl} />
          <ContactFilterControls ctl={filterCtl} />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts" aria-label="Search contacts" className="h-10 w-44 rounded-full bg-card" />
          <button
            type="button"
            className={cn(filterPill, !filterCtl.filters.mode && !filterCtl.filters.cities.length && !query && "bg-primary text-primary-foreground")}
            onClick={() => { filterCtl.resetFilters(); setQuery(""); }}
          >
            All contacts
          </button>
          {locating ? <span className="glass rounded-full px-3 py-2 text-xs text-muted-foreground">Finding addresses…</span> : null}
          {!locating && unplaced > 0 ? <span className="glass rounded-full px-3 py-2 text-xs text-muted-foreground">{unplaced} without a map spot</span> : null}
        </div>
        <div className="glass pointer-events-auto absolute bottom-28 left-3 rounded-2xl px-3 py-2 text-[11px] lg:bottom-4">
          <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#0f766e]" /> On schedule</div>
          <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#f59e0b]" /> Due</div>
          <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#e11d48]" /> Overdue</div>
          <div className="flex items-center gap-2"><span className="size-2 rounded-sm bg-[#c4841d]" /> Start</div>
        </div>
        <button
          type="button"
          className="glass pointer-events-auto absolute bottom-48 left-3 inline-flex size-11 items-center justify-center rounded-2xl lg:bottom-24"
          aria-label="My location"
          onClick={() => {
            navigator.geolocation?.getCurrentPosition((pos) => {
              const map = document.querySelector(".leaflet-container") as HTMLElement | null;
              map?.dispatchEvent(new CustomEvent("cora-locate", { detail: pos.coords }));
            });
          }}
        >
          <LocateFixed className="size-4" />
        </button>
        <div className="pointer-events-auto absolute right-3 bottom-28 lg:bottom-4">
          <button type="button" className="h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground shadow" onClick={() => setRoutesOpen((open) => !open)}>
            Routes
          </button>
          {routesOpen ? (
            <div className="glass mt-2 max-h-64 w-64 overflow-auto rounded-2xl p-2 text-sm">
              {data.routes.map((route) => (
                <button key={route.id} type="button" className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={() => setActiveRoute(route.id)}>
                  <span className="font-medium text-foreground">{route.name}</span>
                  <span className="block text-xs text-mutedink">{route.stopCount} stops · {route.projectName}</span>
                </button>
              ))}
              {!data.routes.length ? <p className="px-2 py-3 text-xs text-mutedink">No saved routes yet.</p> : null}
            </div>
          ) : null}
        </div>
        {contact ? <ContactCard household={contact} point={pointFor(contact)} onClose={() => setContactId("")} /> : null}
      </div>
    </div>
  );
}

function ContactCard({
  household,
  point,
  onClose,
}: {
  household: HouseholdView;
  point: { lat: number; lng: number; approximate: boolean } | null;
  onClose: () => void;
}) {
  return (
    <div className="glass pointer-events-auto absolute bottom-28 left-1/2 w-[min(100%-1.5rem,360px)] -translate-x-1/2 rounded-3xl p-3 lg:bottom-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-heading font-semibold text-foreground">{household.name}</p>
          <p className="text-xs text-mutedink"><AddressLink address={household.address} lat={point && !point.approximate ? point.lat : null} lng={point && !point.approximate ? point.lng : null} /></p>
          {point?.approximate ? <p className="text-[11px] text-mutedink">Pin is at the town center.</p> : null}
          <p className="text-xs text-mutedink">{household.scheduleName}</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose}><X className="size-4" /></button>
      </div>
    </div>
  );
}
