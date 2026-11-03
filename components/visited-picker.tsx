"use client";

import { useState } from "react";
import { currentHebrewYear, formatVisited, hebrewYearChoices, parseVisited, VISIT_SEASONS } from "@/lib/visited";

const field = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

export function VisitedPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [pendingYear, setPendingYear] = useState("");
  const parsed = parseVisited(value);
  const year = parsed.year || pendingYear || String(currentHebrewYear());
  const years = hebrewYearChoices(new Date(), [Number(year)].filter((item) => Number.isInteger(item) && item > 0));
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Season</span>
          <select
            className={field}
            aria-label="Season visited"
            value={parsed.season}
            onChange={(event) => {
              const season = event.target.value;
              if (!season) {
                onChange(parsed.raw ? value : "");
                return;
              }
              onChange(formatVisited(season, year));
            }}
          >
            <option value="">Season</option>
            {VISIT_SEASONS.map((season) => (
              <option key={season} value={season}>{season}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Hebrew year</span>
          <select
            className={field}
            aria-label="Hebrew year visited"
            value={years.includes(Number(year)) ? year : years[0]?.toString() ?? year}
            onChange={(event) => {
              const nextYear = event.target.value;
              setPendingYear(nextYear);
              if (parsed.season) onChange(formatVisited(parsed.season, nextYear));
            }}
          >
            {years.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      {parsed.raw ? <p className="text-xs text-muted-foreground">Saved as {value}. Pick a season to replace it.</p> : null}
    </div>
  );
}
