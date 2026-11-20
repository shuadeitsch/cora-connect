"use client";

import { useEffect, useState } from "react";
import { isSummerHome } from "@/lib/contact-tags";
import { summerContextChanged, summerSettingFor } from "@/lib/summer-default";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SummerMode = "all" | "exclude";
/** Same per-device setting the route builders use (see contact-filters). "1" = exclude. A legacy "only" value from an earlier release reads as All. */
const KEY = "cora_exclude_summer_routes";

export function useSummerMode(data?: AppData, projectId = "", state = ""): [SummerMode, (mode: SummerMode) => void] {
  const [mode, setMode] = useState<SummerMode>("all");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      setMode(raw === "1" ? "exclude" : "all");
      if (raw === "only") window.localStorage.setItem(KEY, "0");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);
  // A new project or state brings in that project's default; a manual choice holds until then.
  useEffect(() => {
    if (!data || !ready) return;
    if (!summerContextChanged("cora_summer_ctx:dashboard", projectId, state)) return;
    const setting = summerSettingFor(data.projectSummerSettings, projectId, state);
    const next: SummerMode = setting && !setting.includeSummer ? "exclude" : "all";
    setMode(next);
    try { window.localStorage.setItem(KEY, next === "exclude" ? "1" : "0"); } catch { /* ignore */ }
  }, [data, projectId, state, ready]);
  return [
    mode,
    (next) => {
      setMode(next);
      try { window.localStorage.setItem(KEY, next === "exclude" ? "1" : "0"); } catch { /* ignore */ }
    },
  ];
}

export function filterSummer<T extends { tags?: string[] | null }>(households: T[], mode: SummerMode): T[] {
  if (mode === "all") return households;
  return households.filter((household) => !isSummerHome(household.tags ?? []));
}

export function SummerModeChoice({ mode, onChange, summer, total, className }: { mode: SummerMode; onChange: (mode: SummerMode) => void; summer: number; total: number; className?: string }) {
  if (!summer && mode === "all") return null;
  const options: { id: SummerMode; label: string }[] = [
    { id: "all", label: `All (${total})` },
    { id: "exclude", label: `Exclude summer homes (${summer})` },
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
