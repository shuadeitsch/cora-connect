"use client";

import { useState, useTransition } from "react";
import { LocateFixed, Navigation, X } from "lucide-react";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MapPoint } from "@/components/map-points";
import { geocodeStartAction } from "@/lib/actions";
import { fullAddress } from "@/lib/format";
import { quickestOrder } from "@/lib/geo";
import type { RouteStopView } from "@/lib/types";

const GOOGLE_LEG = 10; // origin + up to 9 waypoints + destination works on phones.

type Start = { lat: number; lng: number; param: string };

export function StartRoute({
  stops,
  pointOf,
  canSave,
  onOrder,
  onSave,
  onClose,
}: {
  stops: RouteStopView[];
  pointOf: (stop: RouteStopView) => MapPoint | null;
  canSave: boolean;
  onOrder: (ids: string[] | null) => void;
  onSave: (ids: string[]) => Promise<string | null>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [start, setStart] = useState<Start | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [leg, setLeg] = useState(0);
  const [appleStop, setAppleStop] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, run] = useTransition();

  function plan(from: Start) {
    const ids = quickestOrder(from, stops.map((stop) => {
      const point = pointOf(stop);
      return { id: stop.householdId, lat: point?.lat ?? null, lng: point?.lng ?? null };
    }));
    setStart(from);
    setOrder(ids);
    setLeg(0);
    setAppleStop(0);
    setSaved(false);
    onOrder(ids);
  }

  const ordered = order ? order.flatMap((id) => stops.filter((stop) => stop.householdId === id)) : [];
  const place = (stop: RouteStopView) => {
    const point = pointOf(stop);
    return point && !point.approximate ? `${point.lat},${point.lng}` : fullAddress(stop);
  };
  const legs = Math.ceil(ordered.length / GOOGLE_LEG);
  const chunk = ordered.slice(leg * GOOGLE_LEG, (leg + 1) * GOOGLE_LEG);
  const legOrigin = leg === 0 ? start?.param ?? "" : place(ordered[leg * GOOGLE_LEG - 1]!);
  const google = chunk.length
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(legOrigin)}&destination=${encodeURIComponent(place(chunk[chunk.length - 1]!))}${chunk.length > 1 ? `&waypoints=${chunk.slice(0, -1).map((stop) => encodeURIComponent(place(stop))).join("%7C")}` : ""}&travelmode=driving`
    : "";
  const appleTo = ordered[appleStop];
  const appleFrom = appleStop === 0 ? start?.param ?? "" : ordered[appleStop - 1] ? place(ordered[appleStop - 1]!) : "";
  const apple = appleTo ? `https://maps.apple.com/?saddr=${encodeURIComponent(appleFrom)}&daddr=${encodeURIComponent(place(appleTo))}&dirflg=d` : "";

  return (
    <div className="mt-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold text-foreground">Start route</h2>
        <button type="button" aria-label="Close" onClick={() => { onOrder(null); onClose(); }}><X className="size-4" /></button>
      </div>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const typed = text.trim();
          if (!typed) return;
          run(async () => {
            const result = await geocodeStartAction(typed);
            if (!result.ok) setError(result.error);
            else plan({ lat: result.data.lat, lng: result.data.lng, param: typed });
          });
        }}
      >
        <Input className="min-w-0 flex-1" value={text} onChange={(event) => setText(event.target.value)} placeholder="Starting address" aria-label="Starting address" />
        <Button type="submit" className="rounded-full" disabled={pending || !text.trim()}>{pending ? "Finding…" : "Go"}</Button>
        <Button
          type="button"
          variant="outline"
          className="basis-full rounded-full sm:basis-auto"
          onClick={() => {
            setError("");
            if (!navigator.geolocation) { setError("This device can't share its location."); return; }
            navigator.geolocation.getCurrentPosition(
              (pos) => { setText("My location"); plan({ lat: pos.coords.latitude, lng: pos.coords.longitude, param: `${pos.coords.latitude},${pos.coords.longitude}` }); },
              () => setError("Location is blocked. Allow location for this site, or type an address."),
              { enableHighAccuracy: true, timeout: 15000 },
            );
          }}
        >
          <LocateFixed className="size-4" /> Use my location
        </Button>
      </form>
      {error ? <div className="mt-2"><Notice>{error}</Notice></div> : null}
      {order ? (
        <>
          <ol className="mt-3 space-y-1 text-sm">
            {ordered.map((stop, index) => (
              <li key={stop.householdId} className="flex gap-2 rounded-lg bg-background px-2 py-1.5">
                <span className="w-5 shrink-0 font-semibold text-primary">{index + 1}</span>
                <span className="min-w-0"><span className="font-medium text-foreground">{stop.name}</span> <span className="text-xs text-muted-foreground">{stop.city}</span></span>
              </li>
            ))}
          </ol>
          <div className="mt-3 grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <a href={google} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
                <Navigation className="size-4" /> Open in Google Maps{legs > 1 ? ` (part ${leg + 1} of ${legs})` : ""}
              </a>
              {legs > 1 ? (
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setLeg((leg + 1) % legs)}>
                  {leg + 1 < legs ? "Next leg" : "Back to part 1"}
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={apple} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium text-foreground">
                <Navigation className="size-4" /> Open in Apple Maps: stop {appleStop + 1}{appleTo ? `, ${appleTo.name}` : ""}
              </a>
              {ordered.length > 1 ? (
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setAppleStop((appleStop + 1) % ordered.length)}>
                  {appleStop + 1 < ordered.length ? "Next stop" : "Back to stop 1"}
                </Button>
              ) : null}
            </div>
            {canSave ? (
              <Button
                type="button"
                variant="outline"
                className="justify-self-start rounded-full"
                disabled={pending || saved}
                onClick={() => run(async () => {
                  const problem = await onSave(order);
                  if (problem) setError(problem);
                  else setSaved(true);
                })}
              >
                {saved ? "Order saved" : "Save this order"}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
