"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  archiveFeedbackAction,
  deleteFeedbackAction,
  listFeedbackAction,
  markFeedbackReadAction,
  type FeedbackRow,
} from "@/lib/feedback-actions";
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

/** Admin Home card: newest feedback first, mark read, archive, or delete. */
export function FeedbackCard() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmId, setConfirmId] = useState("");
  const [confirmMany, setConfirmMany] = useState(false);
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
      setSelected([]);
      setConfirmId("");
      setConfirmMany(false);
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

  function remove(ids: string[]) {
    setBusy(ids[0] ?? "many");
    start(async () => {
      const result = await deleteFeedbackAction(ids);
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">Feedback</h2>
        <span className="text-xs text-muted-foreground">{rows ? `${rows.length} open` : "…"}</span>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {rows && rows.length && selected.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/40 px-3 py-2">
          <p className="text-sm text-foreground">{selected.length} selected</p>
          {confirmMany ? (
            <>
              <p className="text-sm text-destructive">Delete selected?</p>
              <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-xs" disabled={Boolean(busy)} onClick={() => setConfirmMany(false)}>Cancel</Button>
              <Button type="button" variant="destructive" className="h-9 rounded-full px-3 text-xs" disabled={Boolean(busy)} onClick={() => remove(selected)}>
                {busy ? "Deleting…" : "Delete"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="destructive" className="h-9 rounded-full px-3 text-xs" disabled={Boolean(busy)} onClick={() => setConfirmMany(true)}>
              <Trash2 className="mr-1 size-3.5" /> Delete selected
            </Button>
          )}
        </div>
      ) : null}
      {rows == null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading feedback…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className={cn("space-y-1.5 py-3", !row.readAt && "bg-primary/5 -mx-2 rounded-2xl px-2")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={selected.includes(row.id)}
                    aria-label={`Select feedback from ${row.name || "Unknown"}`}
                    onChange={(event) => {
                      setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id));
                    }}
                  />
                  <span>
                    <p className="text-sm font-medium text-foreground">
                      {row.name || "Unknown"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {(ROLE_LABEL[row.role] ?? row.role) || "—"}
                        {row.state ? ` · ${row.state}` : ""}
                        {row.email ? ` · ${row.email}` : ""}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{row.message}</p>
                  </span>
                </label>
                <span className="text-xs tabular-nums text-muted-foreground">{when(row.createdAt)} ET</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 pl-6">
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
                {confirmId === row.id ? (
                  <>
                    <span className="self-center text-xs text-destructive">Delete?</span>
                    <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-xs" disabled={busy === row.id} onClick={() => setConfirmId("")}>Cancel</Button>
                    <Button type="button" variant="destructive" className="h-9 rounded-full px-3 text-xs" disabled={busy === row.id} onClick={() => remove([row.id])}>
                      {busy === row.id ? "Deleting…" : "Delete"}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-xs text-destructive" disabled={busy === row.id} onClick={() => setConfirmId(row.id)} aria-label="Delete feedback">
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
