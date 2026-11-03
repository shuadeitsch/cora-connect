"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geocodeContactsAction } from "@/lib/actions";
import type { HouseholdView } from "@/lib/types";

export type MapPoint = { lat: number; lng: number; approximate: boolean };
type Found = { addr: string; lat: number; lng: number; approximate: boolean } | { addr: string; lat: null; lng: null; approximate: false };
const FOUND_KEY = "cora-map-points-v1";

function addressOf(household: HouseholdView) {
  return [household.street, household.city, household.state, household.zip].map((part) => part.trim().toLowerCase()).join("|");
}

/** Saved coordinates when the contact has them; otherwise a point looked up for this device and kept in this browser. */
export function useMapPoints(households: HouseholdView[]) {
  const [found, setFound] = useState<Record<string, Found>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FOUND_KEY) ?? "{}") as Record<string, Found>;
      setFound(saved && typeof saved === "object" ? saved : {});
    } catch {
      setFound({});
    }
    setLoaded(true);
  }, []);

  const missing = useMemo(
    () => households.filter((household) => (household.lat == null || household.lng == null) && found[household.id]?.addr !== addressOf(household)),
    [households, found],
  );

  useEffect(() => {
    if (!loaded || running.current || !missing.length) return;
    running.current = true;
    setBusy(true);
    void (async () => {
      const next: Record<string, Found> = {};
      for (let index = 0; index < missing.length; index += 20) {
        const batch = missing.slice(index, index + 20);
        const result = await geocodeContactsAction(batch.map((household) => household.id)).catch(() => null);
        if (!result?.ok) break;
        for (const household of batch) {
          const point = result.data[household.id];
          next[household.id] = point
            ? { addr: addressOf(household), lat: point.lat, lng: point.lng, approximate: point.approximate }
            : { addr: addressOf(household), lat: null, lng: null, approximate: false };
        }
        setFound((current) => {
          const merged = { ...current, ...next };
          try { window.localStorage.setItem(FOUND_KEY, JSON.stringify(merged)); } catch { /* storage full: keep in memory */ }
          return merged;
        });
      }
      running.current = false;
      setBusy(false);
    })();
  }, [loaded, missing]);

  function pointFor(household: HouseholdView): { lat: number; lng: number; approximate: boolean } | null {
    if (household.lat != null && household.lng != null) return { lat: household.lat, lng: household.lng, approximate: false };
    const hit = found[household.id];
    if (!hit || hit.lat == null || hit.addr !== addressOf(household)) return null;
    return { lat: hit.lat, lng: hit.lng, approximate: hit.approximate };
  }

  return { pointFor, busy: busy || (!loaded && households.some((household) => household.lat == null)), missingCount: missing.length };
}
