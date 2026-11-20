"use client";

import { useMemo, useState } from "react";
import { describeMessageStatus } from "@/lib/message-status";
import { channelTypeLabel } from "@/lib/messaging";
import { cleanEmailBody, previewLine } from "@/lib/message-text";
import type { MessageItem, MessageThread } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DeliveryStatus({ status, error }: { status: string; error?: string | null }) {
  const info = describeMessageStatus(status, error);
  if (!info.label) return null;
  if (info.tone === "bad") {
    return (
      <p className="mt-1 rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white [overflow-wrap:anywhere]">
        Failed{info.reason ? `: ${info.reason}` : ""}
      </p>
    );
  }
  return <p className="mt-1 text-[10px] font-medium opacity-80" title={info.reason}>{info.label}</p>;
}

export function MessageBubble({ item, email }: { item: MessageItem; email: boolean }) {
  const [full, setFull] = useState(false);
  const cleaned = useMemo(() => (email ? cleanEmailBody(item.body) : { main: item.body, trimmed: false }), [email, item.body]);
  const out = item.direction === "out";
  return (
    <li className={cn("flex min-w-0", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "min-w-0 max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-snug [overflow-wrap:anywhere] [word-break:break-word] sm:max-w-[78%]",
          out ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {item.subject ? <p className="mb-0.5 text-xs font-medium opacity-80 [overflow-wrap:anywhere]">{item.subject}</p> : null}
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{full ? item.body.trim() : cleaned.main}</p>
        {cleaned.trimmed ? (
          <button
            type="button"
            className="mt-1 inline-flex min-h-8 items-center text-xs font-medium underline underline-offset-2 opacity-90"
            onClick={() => setFull((value) => !value)}
          >
            {full ? "Hide quoted text" : "Show full message"}
          </button>
        ) : null}
        <p className="mt-1 text-[10px] opacity-70">{new Date(item.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
        {out ? <DeliveryStatus status={item.status} error={item.error} /> : null}
      </div>
    </li>
  );
}

function threadTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ThreadRow({ thread, name, active, onPick }: { thread: MessageThread; name: string; active: boolean; onPick: () => void }) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex min-h-11 w-full min-w-0 flex-col items-stretch rounded-xl px-3 py-1.5 text-left text-sm",
          active ? "bg-accent text-foreground" : "hover:bg-muted",
        )}
      >
        <span className="flex w-full min-w-0 items-baseline justify-between gap-2">
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{threadTime(thread.lastAt)}</span>
        </span>
        <span className="mt-0.5 flex w-full min-w-0 items-start gap-2">
          <span className="min-w-0 flex-1 overflow-hidden text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            <span className="font-medium">{channelTypeLabel(thread.channelType)}</span> · {previewLine(thread.lastPreview) || "No preview"}
          </span>
          {thread.unreadCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{thread.unreadCount}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
