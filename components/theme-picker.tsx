"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { saveThemeAction } from "@/lib/theme-actions";
import { applyTheme, isThemeId, THEME_KEY, THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

export function ThemePicker({ saved }: { saved: string | null }) {
  const toast = useToast();
  const [current, setCurrent] = useState<ThemeId>(isThemeId(saved) ? saved : "classic");
  useEffect(() => {
    const local = window.localStorage.getItem(THEME_KEY);
    if (isThemeId(local)) setCurrent(local);
    else if (document.documentElement.classList.contains("dark")) setCurrent("dark");
  }, []);

  async function pick(id: ThemeId) {
    applyTheme(id);
    setCurrent(id);
    const result = await saveThemeAction(id).catch(() => ({ ok: false as const, error: "Couldn't save your theme. It still applies on this device." }));
    if (!result.ok) toast({ title: result.error, tone: "error" });
  }

  return (
    <section className="panel mt-4 max-w-2xl rounded-3xl p-4" aria-label="Theme">
      <h2 className="font-heading text-lg font-semibold text-foreground">Theme</h2>
      <p className="text-sm text-muted-foreground">Pick the colors you like. It&apos;s saved to your account.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEMES.map((theme) => (
          <button key={theme.id} type="button" aria-pressed={current === theme.id} onClick={() => pick(theme.id)}
            className={cn("relative overflow-hidden rounded-2xl text-left ring-1 ring-border transition hover:ring-2 hover:ring-primary/50", current === theme.id && "ring-2 ring-primary")}>
            <div className="flex h-16 items-end gap-1.5 p-2" style={{ background: theme.swatch[1] }}>
              <span className="h-full flex-1 rounded-lg" style={{ background: theme.swatch[2], boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }}>
                <span className="m-1.5 block h-2 w-2/3 rounded-full" style={{ background: theme.swatch[0] }} />
              </span>
              <span className="size-7 rounded-full" style={{ background: theme.swatch[0] }} />
            </div>
            <div className="flex items-center justify-between bg-card px-2.5 py-2 text-sm font-medium text-foreground">
              {theme.label}
              {current === theme.id ? <Check className="size-4 text-primary" /> : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
