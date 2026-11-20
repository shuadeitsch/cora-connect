"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

type Latest = { threadId: string; at: string | null; name: string; channel: string };
let current: number | null = null;
const listeners = new Set<() => void>();

function setCount(next: number) {
  if (current === next) return;
  current = next;
  listeners.forEach((fn) => fn());
}

/** Live unread count for the Pre-planner badges; falls back to the server value until the first poll. */
export function useUnreadCount(initial: number) {
  const live = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => null,
  );
  return live ?? initial;
}

/** Ask the watcher to check right away (after a thread is opened or read). */
export function checkInboxNow() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cora:unread-check"));
}

/** Polls every few seconds while the CRM is open. A new inbound text or WhatsApp reply shows a toast and refreshes the lists. */
export function InboxWatcher({ enabled, initial }: { enabled: boolean; initial: number }) {
  const router = useRouter();
  const toast = useToast();
  const lastAt = useRef<string | null | undefined>(undefined);
  const busy = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    async function check() {
      if (busy.current || document.visibilityState === "hidden") return;
      busy.current = true;
      try {
        const res = await fetch("/api/messaging/unread", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const body = (await res.json()) as { count?: number; enabled?: boolean; latest?: Latest | null };
        if (!body.enabled) return;
        const count = body.count ?? 0;
        const prev = current ?? initial;
        const at = body.latest?.at ?? null;
        const isNew = lastAt.current !== undefined && at && at !== lastAt.current && count > 0;
        if (lastAt.current === undefined) lastAt.current = at;
        setCount(count);
        if (isNew && body.latest) {
          lastAt.current = at;
          const via = body.latest.channel.startsWith("whatsapp") ? "WhatsApp" : "text";
          toastRef.current({ title: `New ${via} reply from ${body.latest.name}`, action: { label: "View", href: "/pre-planner" } });
          window.dispatchEvent(new CustomEvent("cora:inbound", { detail: { threadId: body.latest.threadId } }));
          router.refresh();
        } else if (count !== prev) {
          router.refresh();
        }
      } catch {
        // offline or signed out: try again on the next tick
      } finally {
        busy.current = false;
      }
    }
    void check();
    const timer = window.setInterval(check, 7000);
    const onWake = () => void check();
    window.addEventListener("focus", onWake);
    window.addEventListener("cora:unread-check", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("cora:unread-check", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [enabled, initial, router]);
  return null;
}

export function UnreadBadge({ initial, className }: { initial: number; className?: string }) {
  const count = useUnreadCount(initial);
  if (!count) return null;
  return <span className={className ?? "inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground"}>{count}</span>;
}
