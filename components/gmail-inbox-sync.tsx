"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 120_000;
const DEBOUNCE_MS = 8_000;

export type GmailSyncResult = { ok: boolean; ingested: number; accounts: number; error?: string };

let inflight: Promise<GmailSyncResult> | null = null;
let lastStarted = 0;
let lastResult: GmailSyncResult = { ok: true, ingested: 0, accounts: 0 };

export function requestGmailSync(opts?: { force?: boolean }): Promise<GmailSyncResult> {
  const force = Boolean(opts?.force);
  if (!force && inflight) return inflight;
  if (!force && Date.now() - lastStarted < DEBOUNCE_MS) return Promise.resolve(lastResult);
  lastStarted = Date.now();
  const slot: { current: Promise<GmailSyncResult> | null } = { current: null };
  slot.current = (async () => {
    try {
      const res = await fetch(`/api/gmail/sync${force ? "?force=1" : ""}`, { method: "POST", credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; ingested?: number; accounts?: number; error?: string };
      const result: GmailSyncResult = {
        ok: Boolean(json.ok),
        ingested: Number(json.ingested) || 0,
        accounts: Number(json.accounts) || 0,
        error: typeof json.error === "string" ? json.error : res.ok ? undefined : "Could not sync Gmail.",
      };
      lastResult = result;
      if (result.ok && result.ingested > 0) {
        window.dispatchEvent(new CustomEvent("cora-gmail-synced", { detail: result }));
      }
      return result;
    } catch {
      return { ok: false, ingested: 0, accounts: 0, error: "Could not sync Gmail." };
    } finally {
      if (inflight === slot.current) inflight = null;
    }
  })();
  inflight = slot.current;
  return slot.current;
}

/** While the signed-in app is open and visible, pull Gmail history about every two minutes. */
export function useGmailSyncPolling(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function tick() {
      if (document.visibilityState === "visible") void requestGmailSync();
    }
    const id = window.setInterval(tick, INTERVAL_MS);
    function onVis() {
      if (document.visibilityState === "visible") void requestGmailSync();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled]);
}

/** Call once when Inbox, Pre-planner, or a contact card opens. */
export function useGmailSyncOnOpen(active = true, token?: string) {
  useEffect(() => {
    if (active) void requestGmailSync();
  }, [active, token]);
}

export function useRefreshOnGmailSync() {
  const router = useRouter();
  useEffect(() => {
    function onSync() {
      router.refresh();
    }
    window.addEventListener("cora-gmail-synced", onSync);
    return () => window.removeEventListener("cora-gmail-synced", onSync);
  }, [router]);
}
