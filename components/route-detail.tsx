"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Navigation, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaggedRouteNotice } from "@/components/tagged-route-notice";
import type { MapPin } from "@/components/map-canvas";
import { deleteRouteAction, saveRouteAction } from "@/lib/actions";
import { mapsHref } from "@/lib/format";
import { nearestNeighbor } from "@/lib/geo";
import type { AppData, RouteView } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/map-canvas").then((mod) => mod.MapCanvas), { ssr: false });

export function RouteDetail({ data, route }: { data: AppData; route: RouteView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pins: MapPin[] = route.stops.flatMap((stop) =>
    stop.lat != null && stop.lng != null
      ? [{ id: stop.householdId, name: stop.name, address: `${stop.street}, ${stop.city}`, lat: stop.lat, lng: stop.lng, due: "ok" as const, schedule: "" }]
      : [],
  );
  const numbers = Object.fromEntries(route.stops.map((stop, index) => [stop.householdId, index + 1]));

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
          {data.viewer.canCreateRoute ? (
            <Button
              variant="outline"
              className="rounded-full"
              disabled={pending}
              onClick={() => {
                const ordered = nearestNeighbor(
                  data.org.startLat != null && data.org.startLng != null ? { lat: data.org.startLat, lng: data.org.startLng } : null,
                  route.stops.map((stop) => ({ id: stop.householdId, lat: stop.lat, lng: stop.lng })),
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
        <ol className="mt-4 space-y-2">
          {route.stops.map((stop, index) => (
            <li key={stop.householdId} className="rounded-xl bg-card p-3 shadow-sm ring-1 ring-foreground/8">
              <p className="text-sm font-semibold text-foreground">{index + 1}. {stop.name}</p>
              <p className="text-xs text-mutedink">{stop.street}, {stop.city}, {stop.state} {stop.zip}</p>
              <div className="mt-2 flex gap-2">
                <a className="inline-flex items-center gap-1 text-xs text-link" href={mapsHref(stop.lat, stop.lng, `${stop.street}, ${stop.city}`)} target="_blank" rel="noreferrer">
                  <Navigation className="size-3.5" /> Navigate
                </a>
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
          onAdd={() => {}}
          onOpen={(id) => router.push(`/households?focus=${id}`)}
          onVisit={(id) => router.push(`/reports?new=1&household=${id}`)}
        />
      </div>
    </div>
  );
}
