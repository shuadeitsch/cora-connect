"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadThreadMessagesAction, markThreadReadAction, sendCampaignMessageAction } from "@/lib/actions";
import { channelFamily, channelTypeLabel, withinWhatsAppWindow } from "@/lib/messaging";
import type { AppData, MessageItem, MessageThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UnmatchedInbox, useUnmatchedCount } from "@/components/unmatched-inbox";
import { MessageBubble, ThreadRow } from "@/components/message-bubble";
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
  const paneRef = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    const el = paneRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);
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
    <div className={cn("grid min-w-0 gap-3", compact ? "" : "lg:grid-cols-[18rem_minmax(0,1fr)]", admin && !compact && tabKey === "unknown" ? "hidden" : "")}>
      <ul className="grid min-w-0 content-start gap-1 lg:max-h-[70vh] lg:overflow-y-auto">
        {threads.length ? threads.map((thread) => {
          const house = houses.get(thread.householdId);
          return (
            <ThreadRow key={thread.id} thread={thread} name={house?.name ?? "Contact"} active={activeId === thread.id} onPick={() => setActiveId(thread.id)} />
          );
        }) : <li className="text-sm text-muted-foreground">No messages yet.</li>}
      </ul>
      {active ? (
        <div className="grid min-w-0 gap-2 rounded-2xl border bg-card p-3">
          <p className="min-w-0 border-b pb-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]">{houses.get(active.householdId)?.name ?? "Contact"} · {channelTypeLabel(active.channelType)}</p>
          <ol ref={paneRef} className="grid max-h-[min(60vh,34rem)] min-h-40 min-w-0 content-start gap-2 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5">
            {messages.map((item) => (
              <MessageBubble key={item.id} item={item} email={channelFamily(item.channelType) === "email"} />
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

export function inboxUnread(threads: MessageThread[]): number {
  return threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
}
