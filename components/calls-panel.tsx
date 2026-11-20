"use client";

import { useEffect, useState } from "react";
import { useCall } from "@/components/call-provider";
import { CallRowView } from "@/components/call-history";
import { listRecentCallsAction } from "@/lib/voice-actions";
import type { CallRow } from "@/lib/voice-shared";

/** Every call made or received through the CRM, newest first. Shown as the Pre-planner "Calls" tab. */
export function CallsPanel() {
  const { version } = useCall();
  const [rows, setRows] = useState<CallRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void listRecentCallsAction().then((list) => { if (!cancelled) setRows(list); }).catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [version]);
  if (rows === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">No calls yet. Use the Call button on a Reached out card or in the Inbox.</p>;
  return (
    <ul className="grid gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <p className="mb-1 text-sm font-semibold text-foreground">{row.contactName ?? `Unknown caller ${row.contactNumber}`}</p>
          <ul><CallRowView row={row} /></ul>
        </li>
      ))}
    </ul>
  );
}
