"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useMapPoints } from "@/components/map-points";
import { StartRoute } from "@/components/start-route";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Navigation, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaggedRouteNotice } from "@/components/tagged-route-notice";
import type { MapPin } from "@/components/map-canvas";
import { deleteRouteAction, saveRouteAction } from "@/lib/actions";
import { AddressLink } from "@/components/address-link";
import { fullAddress } from "@/lib/format";
import { nearestNeighbor } from "@/lib/geo";
import type { AppData, RouteStopView, RouteView } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map-canvas").then((mod) => mod.MapCanvas), { ssr: false });

export function RouteDetail({ data, route }: { data: AppData; route: RouteView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { pointFor } = useMapPoints(data.households);
  const [starting, setStarting] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const pointOf = (stop: RouteStopView) => {
    const household = data.households.find((item) => item.id === stop.householdId);
    if (household) return pointFor(household);
    return stop.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng, approximate: false } : null;
  };
  const shownStops = order ? order.flatMap((id) => route.stops.filter((stop) => stop.householdId === id)) : route.stops;
  const pins: MapPin[] = shownStops.flatMap((stop) => {
    const point = pointOf(stop);
    return point
      ? [{ id: stop.householdId, name: stop.name, address: `${stop.street}, ${stop.city}`, lat: point.lat, lng: point.lng, due: "ok" as const, schedule: "" }]
      : [];
  });
  const numbers = Object.fromEntries(shownStops.map((stop, index) => [stop.householdId, index + 1]));

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[380px_1fr] lg:p-6">
      <div>
        <Link href="/saved-routes" className="inline-flex items-center gap-1 text-sm text-link"><ArrowLeft className="size-4" /> Saved routes</Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-foreground">{route.name}</h1>
        <p className="text-sm text-mutedink">{route.projectName} · {route.stopCount} stops{route.miles != null ? ` · ${route.miles} miles` : ""}{route.optimized ? " · optimized" : ""}</p>
        <div className="mt-3">
          <TaggedRouteNotice
            households={data.households}
            stops={route.stops.map((stop) => ({ householdId: stop.householdId, city: stop.city, state: stop.state }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="rounded-full" onClick={() => setStarting(true)} disabled={!route.stops.length}><Play className="size-4" /> Start route</Button>
          {data.viewer.canCreateRoute ? (
            <Button
              variant="outline"
              className="rounded-full"
              disabled={pending}
              onClick={() => {
                const ordered = nearestNeighbor(
                  data.org.startLat != null && data.org.startLng != null ? { lat: data.org.startLat, lng: data.org.startLng } : null,
                  route.stops.map((stop) => {
                    const point = pointOf(stop);
                    return { id: stop.householdId, lat: point?.lat ?? null, lng: point?.lng ?? null };
                  }),
                );
                start(async () => {
                  const result = await saveRouteAction({ id: route.id, name: route.name, projectId: route.projectId ?? "", optimized: true, householdIds: ordered });
                  if (result.ok) router.refresh();
                });
              }}
            >
              Auto-order
            </Button>
          ) : null}
          {data.viewer.canDeleteRoute ? (
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={pending}
              onClick={() => {
                if (!confirm("Delete this route?")) return;
                start(async () => {
                  const result = await deleteRouteAction(route.id);
                  if (result.ok) router.push("/saved-routes");
                });
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          ) : null}
        </div>
        {starting ? (
          <StartRoute
            stops={route.stops}
            pointOf={pointOf}
            canSave={data.viewer.canCreateRoute}
            onOrder={setOrder}
            onClose={() => setStarting(false)}
            onSave={async (ids) => {
              const result = await saveRouteAction({ id: route.id, name: route.name, projectId: route.projectId ?? "", optimized: true, householdIds: ids });
              if (!result.ok) return result.error;
              router.refresh();
              return null;
            }}
          />
        ) : null}
        <ol className="mt-4 space-y-2">
          {route.stops.map((stop, index) => (
            <li key={stop.householdId} className="rounded-xl bg-card p-3 shadow-sm ring-1 ring-foreground/8">
              <p className="text-sm font-semibold text-foreground">{index + 1}. {stop.name}</p>
              <p className="text-xs text-mutedink">
                <AddressLink address={fullAddress(stop)} lat={stop.lat} lng={stop.lng} />
              </p>
              <div className="mt-2 flex gap-2">
                <AddressLink address={fullAddress(stop)} lat={stop.lat} lng={stop.lng} label="Navigate" className="inline-flex items-center gap-1 text-xs text-link">
                  <Navigation className="size-3.5" /> Navigate
                </AddressLink>
                {stop.phone ? <a className="text-xs text-link" href={`tel:${stop.phone.replace(/\D/g, "")}`}>Call</a> : null}
                <Link className="text-xs text-link" href={`/reports?new=1&household=${stop.householdId}`}>Log visit</Link>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="h-[50vh] panel overflow-hidden rounded-3xl lg:h-[calc(100dvh-8rem)]">
        <MapCanvas
          pins={pins}
          selected={route.stops.map((stop) => stop.householdId)}
          numbers={numbers}
          start={data.org.startLat != null && data.org.startLng != null ? { lat: data.org.startLat, lng: data.org.startLng } : null}
          routeLine={pins.map((pin) => ({ lat: pin.lat, lng: pin.lng }))}
          onOpen={(id) => router.push(`/households?focus=${id}`)}
          onVisit={(id) => router.push(`/reports?new=1&household=${id}`)}
        />
      </div>
    </div>
  );
}
