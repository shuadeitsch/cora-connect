"use client";

import { useEffect, useState, useTransition } from "react";
import { archiveFeedbackAction, listFeedbackAction, markFeedbackReadAction, type FeedbackRow } from "@/lib/feedback-actions";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TZ = "America/New_York";

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Admin Dashboard card: newest feedback first, mark read or archive. */
export function FeedbackCard() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [, start] = useTransition();

  function load() {
    start(async () => {
      const result = await listFeedbackAction();
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
  }, []);

  function act(id: string, kind: "read" | "archive") {
    setBusy(id);
    start(async () => {
      const result = kind === "read" ? await markFeedbackReadAction(id) : await archiveFeedbackAction(id);
      setBusy("");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      load();
    });
  }

  return (
    <section className="panel rounded-3xl p-4" aria-label="Feedback">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">Feedback</h2>
        <span className="text-xs text-muted-foreground">{rows ? `${rows.length} open` : "…"}</span>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {rows == null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading feedback…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className={cn("space-y-1.5 py-3", !row.readAt && "bg-primary/5 -mx-2 rounded-2xl px-2")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {row.name || "Someone"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {ROLE_LABEL[row.role] ?? row.role}
                    {row.state ? ` · ${row.state}` : ""}
                  </span>
                </p>
                <span className="text-xs tabular-nums text-muted-foreground">{when(row.createdAt)} ET</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{row.message}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {!row.readAt ? (
                  <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-xs" disabled={busy === row.id} onClick={() => act(row.id, "read")}>
                    Mark read
                  </Button>
                ) : (
                  <span className="self-center text-[11px] text-muted-foreground">Read</span>
                )}
                <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-xs" disabled={busy === row.id} onClick={() => act(row.id, "archive")}>
                  Archive
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
