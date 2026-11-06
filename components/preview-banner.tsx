"use client";

import { useTransition } from "react";
import { exitPreviewAction } from "@/lib/preview-actions";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/constants";

export function PreviewBanner({ role, state }: { role: "shliach" | "bochur"; state: string | null }) {
  const [pending, start] = useTransition();
  const label = role === "shliach" ? `${ROLE_LABEL.shliach}${state ? ` · ${state}` : ""}` : ROLE_LABEL.bochur;
  return (
    <div className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
      <p>
        <span className="font-semibold">Preview only</span> — viewing as {label}. Changes are blocked.
      </p>
      <Button
        type="button"
        variant="outline"
        className="min-h-10 rounded-full border-amber-800/30 bg-background/60"
        disabled={pending}
        onClick={() => start(async () => { await exitPreviewAction(); })}
      >
        {pending ? "Leaving…" : "Exit"}
      </Button>
    </div>
  );
}
