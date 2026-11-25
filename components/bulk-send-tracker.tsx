"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type BulkJob = {
  id: string;
  label: string;
  status: "running" | "done" | "stopped";
  total: number;
  sent: number;
  failed: number;
  finishedAt: string | null;
  stalled: boolean;
  results?: { name: string; ok: boolean; error?: string | null }[];
};

export type BulkSendInput = Record<string, unknown> & { name: string };

const STARTED = "cora:bulk-started";
const HIDDEN_KEY = "cora_bulk_hidden_v1";

/** Hand the prepared messages to the server. They keep sending even if this window or page is closed. */
export async function startBulkSend(label: string, items: BulkSendInput[]): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/bulk-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, items }) });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
    if (!res.ok || !body.ok || !body.id) return { ok: false, error: body.error || "Could not start the send." };
    window.dispatchEvent(new Event(STARTED));
    return { ok: true, id: body.id };
  } catch {
    return { ok: false, error: "The connection dropped. Check the send tracker or Inbox before retrying." };
  }
}

async function resume(id: string) {
  try {
    await fetch("/api/bulk-send/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  } catch {
    // try again on the next tick
  }
}

/** Live progress for one job (the send dialog). */
export function useBulkJob(id: string | null) {
  const [job, setJob] = useState<BulkJob | null>(null);
  useEffect(() => {
    if (!id) {
      setJob(null);
      return;
    }
    let alive = true;
    let timer = 0;
    async function tick() {
      try {
        const res = await fetch(`/api/bulk-send?id=${encodeURIComponent(id!)}`, { cache: "no-store" });
        const body = (await res.json()) as { job?: BulkJob | null };
        if (!alive) return;
        if (body.job) {
          setJob(body.job);
          if (body.job.stalled) void resume(body.job.id);
          if (body.job.status !== "running") return;
        }
      } catch {
        // offline: keep trying
      }
      if (alive) timer = window.setTimeout(tick, 2500);
    }
    void tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [id]);
  return job;
}

function readHidden(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(HIDDEN_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

/** Small floating tracker on every page: shows any bulk send that is running (or just finished), straight from the server. */
export function BulkSendTracker({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const running = useRef(false);
  const wasRunning = useRef(new Set<string>());

  const check = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const res = await fetch("/api/bulk-send", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { jobs?: BulkJob[]; enabled?: boolean };
      const list = body.jobs ?? [];
      setJobs(list);
      running.current = list.some((job) => job.status === "running");
      for (const job of list) {
        if (job.status === "running") {
          wasRunning.current.add(job.id);
          if (job.stalled) void resume(job.id);
        } else if (wasRunning.current.delete(job.id)) {
          router.refresh();
        }
      }
    } catch {
      // offline or signed out
    }
  }, [router]);

  useEffect(() => {
    if (!enabled) return;
    setHidden(readHidden());
    void check();
    let timer = 0;
    const loop = () => {
      timer = window.setTimeout(async () => {
        await check();
        loop();
      }, running.current ? 3000 : 30000);
    };
    loop();
    const now = () => void check();
    window.addEventListener(STARTED, now);
    window.addEventListener("focus", now);
    document.addEventListener("visibilitychange", now);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(STARTED, now);
      window.removeEventListener("focus", now);
      document.removeEventListener("visibilitychange", now);
    };
  }, [enabled, check]);

  const shown = jobs.filter((job) => !hidden.includes(job.id));
  if (!enabled || !shown.length) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] grid w-[min(100%-1.5rem,18rem)] gap-2">
      {shown.slice(0, 3).map((job) => {
        const done = job.sent + job.failed;
        const pct = job.total ? Math.round((done / job.total) * 100) : 0;
        const finished = job.status !== "running";
        return (
          <div key={job.id} className="pointer-events-auto rounded-2xl border bg-card px-3 py-2 text-sm shadow-lg" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium text-foreground">{finished ? "Done" : "Sending"}{job.label ? ` · ${job.label}` : ""}</span>
              {finished ? (
                <button
                  type="button"
                  className="min-h-8 shrink-0 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted"
                  aria-label="Hide"
                  onClick={() => {
                    const next = [...hidden, job.id].slice(-50);
                    setHidden(next);
                    try { window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
                  }}
                >
                  ✕
                </button>
              ) : null}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className={finished ? "h-full bg-emerald-600" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {job.sent} sent · <span className={job.failed ? "text-red-700" : ""}>{job.failed} failed</span> · {job.total} total
            </p>
          </div>
        );
      })}
    </div>
  );
}
