"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadThreadMessagesAction, markThreadReadAction, sendCampaignMessageAction } from "@/lib/actions";
import { channelFamily, channelTypeLabel, withinWhatsAppWindow } from "@/lib/messaging";
import type { AppData, MessageItem, MessageThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UnmatchedInbox, useUnmatchedCount } from "@/components/unmatched-inbox";
import { describeMessageStatus } from "@/lib/message-status";
import { usePractice } from "@/components/practice-provider";
import { requestGmailSync, useGmailSyncOnOpen, useRefreshOnGmailSync } from "@/components/gmail-inbox-sync";

export function MessageInbox({
  data,
  householdId,
  compact = false,
}: {
  data: AppData;
  householdId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const practice = usePractice();
  const threads = useMemo(
    () => (data.messageThreads ?? []).filter((thread) => !householdId || thread.householdId === householdId),
    [data.messageThreads, householdId],
  );
  const [activeId, setActiveId] = useState<string | null>(threads[0]?.id ?? null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [reply, setReply] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const live = !data.viewer.preview && !data.viewer.sandbox;
  useGmailSyncOnOpen(live);
  const [syncProblem, setSyncProblem] = useState("");
  useEffect(() => {
    if (!live || data.viewer.role !== "admin") return;
    void requestGmailSync().then((result) => setSyncProblem(result.error ? result.error : ""));
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps -- check once when the Inbox opens
  useRefreshOnGmailSync();
  const active = threads.find((thread) => thread.id === activeId) ?? null;
  const houses = useMemo(() => new Map(data.households.map((house) => [house.id, house])), [data.households]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    start(async () => {
      const result = await loadThreadMessagesAction(activeId);
      if (result.ok) setMessages(result.data ?? []);
      else setError(result.error);
      await markThreadReadAction(activeId);
      router.refresh();
    });
  }, [activeId]);

  const needsWhatsAppTemplate = Boolean(active && channelFamily(active.channelType) === "whatsapp" && !withinWhatsAppWindow(active.lastInboundAt));

  const admin = data.viewer.role === "admin" && !data.viewer.preview;
  const [tabKey, setTabKey] = useState<"chats" | "unknown">("chats");
  const [unknownCount, setUnknownCount] = useUnmatchedCount(admin && !compact && live);
  return (
    <div className="grid min-w-0 gap-3">
      {admin && !compact ? (
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-full border bg-card p-1" role="tablist">
          <button type="button" role="tab" aria-selected={tabKey === "chats"} className={cn("min-h-10 rounded-full px-3.5 text-sm font-medium", tabKey === "chats" ? "bg-primary text-primary-foreground" : "")} onClick={() => setTabKey("chats")}>Conversations</button>
          <button type="button" role="tab" aria-selected={tabKey === "unknown"} className={cn("min-h-10 rounded-full px-3.5 text-sm font-medium", tabKey === "unknown" ? "bg-primary text-primary-foreground" : "")} onClick={() => setTabKey("unknown")}>Unknown sender{unknownCount ? ` (${unknownCount})` : ""}</button>
        </div>
      ) : null}
      {syncProblem && admin ? <p className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white [overflow-wrap:anywhere]">Gmail sync failed: {syncProblem}</p> : null}
      {admin && !compact && tabKey === "unknown" ? <UnmatchedInbox data={data} onCount={setUnknownCount} /> : null}
      {admin && !compact ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full"
            disabled={syncing || !live}
            onClick={() => {
              setSyncing(true);
              setError("");
              void requestGmailSync({ force: true }).then((result) => {
                setSyncing(false);
                if (!result.ok) {
                  setError(result.error || "Could not sync Gmail.");
                  return;
                }
                if (result.ingested) router.refresh();
              });
            }}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      ) : null}
    <div className={cn("grid min-w-0 gap-3", compact ? "" : "lg:grid-cols-[16rem_minmax(0,1fr)]", admin && !compact && tabKey === "unknown" ? "hidden" : "")}>
      <ul className="grid min-w-0 content-start gap-1">
        {threads.length ? threads.map((thread) => {
          const house = houses.get(thread.householdId);
          return (
            <li key={thread.id} className="min-w-0">
              <button
                type="button"
                onClick={() => setActiveId(thread.id)}
                className={cn(
                  "flex min-h-12 w-full min-w-0 flex-col items-stretch rounded-2xl px-3 py-2 text-left text-sm",
                  activeId === thread.id ? "bg-accent text-foreground" : "hover:bg-muted",
                )}
              >
                <span className="flex w-full min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{house?.name ?? "Contact"}</span>
                  {thread.unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{thread.unreadCount}</span>
                  ) : null}
                </span>
                <span className="block min-w-0 truncate text-xs text-muted-foreground">{channelTypeLabel(thread.channelType)} · {thread.lastPreview || "No preview"}</span>
              </button>
            </li>
          );
        }) : <li className="text-sm text-muted-foreground">No messages yet.</li>}
      </ul>
      {active ? (
        <div className="grid min-w-0 gap-2 rounded-2xl border bg-card p-3">
          <p className="min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere]">{houses.get(active.householdId)?.name ?? "Contact"} · {channelTypeLabel(active.channelType)}</p>
          <ol className="grid max-h-80 min-w-0 gap-2 overflow-y-auto overflow-x-hidden">
            {messages.map((item) => (
              <li key={item.id} className={cn("min-w-0 max-w-[90%] rounded-2xl px-3 py-2 text-sm [overflow-wrap:anywhere]", item.direction === "out" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                {item.subject ? <p className="text-xs opacity-80">{item.subject}</p> : null}
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{item.body}</p>
                <p className="mt-1 text-[10px] opacity-70">{new Date(item.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                {item.direction === "out" ? <DeliveryStatus status={item.status} error={item.error} /> : null}
              </li>
            ))}
          </ol>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {needsWhatsAppTemplate ? (
            <input className="h-11 rounded-xl border px-3 text-sm" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="WhatsApp template name or Content SID" />
          ) : null}
          <Textarea className="min-h-20 w-full min-w-0" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply on the same channel" />
          <Button
            type="button"
            className="min-h-11 rounded-full"
            disabled={pending || !reply.trim() || (needsWhatsAppTemplate && !templateName.trim())}
            onClick={() => start(async () => {
              setError("");
              if (practice.active) {
                setReply("");
                return;
              }
              const type = (active.channelType === "email_gmail" || active.channelType === "email_resend" || active.channelType === "sms_twilio" || active.channelType === "whatsapp_twilio")
                ? active.channelType
                : channelFamily(active.channelType) === "email" ? "email_resend" : channelFamily(active.channelType) === "whatsapp" ? "whatsapp_twilio" : "sms_twilio";
              const result = await sendCampaignMessageAction({
                channelId: active.channelId ?? undefined,
                type,
                to: active.contactAddress,
                body: reply.trim(),
                householdId: active.householdId,
                personId: active.personId ?? undefined,
                projectId: active.projectId,
                templateName: needsWhatsAppTemplate ? templateName.trim() : undefined,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setReply("");
              const loaded = await loadThreadMessagesAction(active.id);
              if (loaded.ok) setMessages(loaded.data ?? []);
              router.refresh();
            })}
          >
            Send reply
          </Button>
        </div>
      ) : null}
    </div>
    </div>
  );
}

function DeliveryStatus({ status, error }: { status: string; error?: string | null }) {
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

export function inboxUnread(threads: MessageThread[]): number {
  return threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
}
