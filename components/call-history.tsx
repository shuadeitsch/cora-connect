"use client";

import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
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

