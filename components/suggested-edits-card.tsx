"use client";

import { useEffect, useState, useTransition } from "react";
import {
  approveSuggestionAction,
  listPendingSuggestionsAction,
  rejectSuggestionAction,
  type ContactEditSuggestion,
} from "@/lib/suggestion-actions";
import { Button } from "@/components/ui/button";

/** Shliach/admin Dashboard: pending contact edit suggestions from bochurim. */
export function SuggestedEditsCard({ state = "ALL" }: { state?: string }) {
  const [rows, setRows] = useState<ContactEditSuggestion[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [, start] = useTransition();

  function load() {
    start(async () => {
      const result = await listPendingSuggestionsAction(state);
      if (!result.ok) {
        setError(result.error);
        setRows([]);
        return;
      }
      setError("");
      setRows(result.data?.rows ?? []);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function act(id: string, kind: "approve" | "reject") {
    setBusy(id);
    start(async () => {
      const result = kind === "approve" ? await approveSuggestionAction(id) : await rejectSuggestionAction(id);
      setBusy("");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      load();
    });
  }

  return (
    <section className="panel rounded-3xl p-4" aria-label="Suggested edits">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">Suggested edits</h2>
        <span className="text-xs text-muted-foreground">{rows ? `${rows.length} pending` : "…"}</span>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {rows == null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading suggestions…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No pending suggestions.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="space-y-2 py-3">
              <p className="text-sm text-foreground">
                <span className="font-medium">{row.bochurName}</span>
                <span className="text-muted-foreground"> suggested changes to </span>
                <span className="font-medium">{row.householdName}</span>
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {row.changes.map((change, index) => (
                  <li key={`${row.id}-${index}`}>
                    <span className="font-medium text-foreground">{change.field}</span>:{" "}
                    <span className="line-through">{change.old || "—"}</span>
                    {" → "}
                    <span className="text-foreground">{change.new || "—"}</span>
                  </li>
                ))}
              </ul>
              {row.note ? <p className="text-xs text-muted-foreground">Note: {row.note}</p> : null}
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" className="h-9 rounded-full px-3 text-xs" disabled={busy === row.id} onClick={() => act(row.id, "approve")}>
                  Approve
                </Button>
                <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-xs" disabled={busy === row.id} onClick={() => act(row.id, "reject")}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
