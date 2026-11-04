"use client";

import { useState } from "react";
import type { RouteStopView } from "@/lib/types";

export function routeCities(stops: Pick<RouteStopView, "city" | "position">[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const stop of [...stops].sort((a, b) => a.position - b.position)) {
    const label = stop.city?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  return [...counts.values()];
}

const chip = "inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[10px] leading-4 text-muted-foreground ring-1 ring-foreground/5";

export function RouteCities({ stops, max = 4, className = "" }: { stops: Pick<RouteStopView, "city" | "position">[]; max?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const cities = routeCities(stops);
  if (!cities.length) return null;
  const shown = open ? cities : cities.slice(0, max);
  const hidden = cities.length - shown.length;
  const full = cities.map((city) => `${city.label} ${city.count}`).join(", ");
  return (
    <div className={`mt-1 flex flex-wrap gap-1 ${className}`} aria-label={`Cities: ${full}`}>
      {shown.map((city) => (
        <span key={city.label} className={chip}>
          {city.label}<span className="tabular-nums opacity-70">{city.count}</span>
        </span>
      ))}
      {hidden > 0 ? (
        <button type="button" title={full} className={`${chip} hover:text-foreground`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>
          +{hidden} more
        </button>
      ) : null}
    </div>
  );
}
