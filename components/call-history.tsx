"use client";

import { useEffect, useState } from "react";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { useCall } from "@/components/call-provider";
import { listCallsAction } from "@/lib/voice-actions";
import { formatDuration, outcomeLabel, type CallRow } from "@/lib/voice-shared";

export function CallRowView({ row }: { row: CallRow }) {
  const when = new Date(row.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const Icon = row.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  return (
    <li className="rounded-xl border bg-background p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Icon className="size-3.5 text-muted-foreground" aria-label={row.direction === "inbound" ? "Incoming call" : "Outgoing call"} />
        <span className="font-medium text-foreground">{when}</span>
        <span className="text-muted-foreground">{row.durationSeconds ? formatDuration(row.durationSeconds) : "no answer"}</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{row.voicemail ? "Voicemail" : outcomeLabel(row.outcome)}</span>
      </div>
      {row.notes ? <p className="mt-1 whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{row.notes}</p> : null}
      {row.hasRecording ? <audio className="mt-1.5 h-9 w-full" controls preload="none" src={`/api/voice/recording/${row.id}`} /> : null}
    </li>
  );
}

export function CallHistory({ householdId }: { householdId: string }) {
  const { enabled, version } = useCall();
  const [rows, setRows] = useState<CallRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRows(null);
    void listCallsAction(householdId).then((list) => { if (!cancelled) setRows(list); }).catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [householdId, version]);
  if (!enabled && !rows?.length) return null;
  return (
    <section aria-label="Calls">
      <p className="font-heading text-sm font-semibold text-foreground">Calls</p>
      {rows === null ? <p className="mt-1 text-sm text-muted-foreground">Loading…</p> : rows.length ? (
        <ul className="mt-1.5 grid gap-1.5">{rows.map((row) => <CallRowView key={row.id} row={row} />)}</ul>
      ) : <p className="mt-1 text-sm text-muted-foreground">No calls yet.</p>}
    </section>
  );
}
