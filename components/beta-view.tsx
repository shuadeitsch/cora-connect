"use client";

import { useEffect, useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FOCUS_STATES } from "@/lib/constants";
import { startPreviewAction } from "@/lib/preview-actions";

const STATES = FOCUS_STATES.filter((item) => item.code !== "Unsorted");

/** Admin-only Beta: open a read-only copy of the CRM as a bochur or shliach. */
export function BetaView() {
  const [state, setState] = useState("ME");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem("cora-beta-state");
      if (saved) setState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function open(role: "bochur" | "shliach") {
    setError("");
    try {
      window.sessionStorage.setItem("cora-beta-state", state);
    } catch {
      /* ignore */
    }
    start(async () => {
      const result = await startPreviewAction(role, state);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader title="Beta" crumb="Beta" />
      <p className="max-w-2xl text-sm text-muted-foreground">
        Open a read-only copy of Cora Connect exactly as a bochur or shliach sees it. Nothing you click there changes real data.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="panel rounded-3xl p-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">View as bochur</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a state. He only sees shared contacts in that shliach territory.</p>
          <label className="mt-3 grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">State</span>
            <select
              aria-label="Bochur state"
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
              value={state}
              onChange={(event) => setState(event.target.value)}
            >
              {STATES.map((item) => (
                <option key={item.code} value={item.code}>{item.name}</option>
              ))}
            </select>
          </label>
          <Button type="button" className="mt-4 min-h-11 rounded-full" disabled={pending} onClick={() => open("bochur")}>
            Open bochur view
          </Button>
        </section>
        <section className="panel rounded-3xl p-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">View as shliach</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a state. He only sees that state&apos;s contacts.</p>
          <label className="mt-3 grid gap-1 text-sm">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">State</span>
            <select
              aria-label="Shliach state"
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
              value={state}
              onChange={(event) => setState(event.target.value)}
            >
              {STATES.map((item) => (
                <option key={item.code} value={item.code}>{item.name}</option>
              ))}
            </select>
          </label>
          <Button type="button" className="mt-4 min-h-11 rounded-full" disabled={pending} onClick={() => open("shliach")}>
            Open shliach view
          </Button>
        </section>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
