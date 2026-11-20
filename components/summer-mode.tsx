"use client";

import { useEffect, useState } from "react";
import { isSummerHome } from "@/lib/contact-tags";
import { cn } from "@/lib/utils";

export type SummerMode = "all" | "exclude" | "only";
/** Same per-device setting the route builders use (see contact-filters). "1" = exclude, "only" = summer only. */
const KEY = "cora_exclude_summer_routes";

export function useSummerMode(): [SummerMode, (mode: SummerMode) => void] {
  const [mode, setMode] = useState<SummerMode>("all");
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      setMode(raw === "only" ? "only" : raw === "1" ? "exclude" : "all");
    } catch {
      /* ignore */
    }
  }, []);
  return [
    mode,
    (next) => {
      setMode(next);
      try { window.localStorage.setItem(KEY, next === "only" ? "only" : next === "exclude" ? "1" : "0"); } catch { /* ignore */ }
    },
  ];
}

export function filterSummer<T extends { tags?: string[] | null }>(households: T[], mode: SummerMode): T[] {
  if (mode === "all") return households;
  return households.filter((household) => isSummerHome(household.tags ?? []) === (mode === "only"));
}

export function SummerModeChoice({ mode, onChange, summer, total, className }: { mode: SummerMode; onChange: (mode: SummerMode) => void; summer: number; total: number; className?: string }) {
  if (!summer && mode === "all") return null;
  const options: { id: SummerMode; label: string }[] = [
    { id: "all", label: `All (${total})` },
    { id: "exclude", label: `Exclude summer homes (${summer})` },
    { id: "only", label: `Summer only (${summer})` },
  ];
  return (
    <div role="radiogroup" aria-label="Summer homes" className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-full border border-border bg-card p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={mode === option.id}
          className={cn("min-h-8 rounded-full px-2.5 text-[11px]", mode === option.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
