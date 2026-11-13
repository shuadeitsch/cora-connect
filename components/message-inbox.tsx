"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadThreadMessagesAction, markThreadReadAction, sendCampaignMessageAction } from "@/lib/actions";
import { channelFamily, channelTypeLabel, withinWhatsAppWindow } from "@/lib/messaging";
import type { AppData, MessageItem, MessageThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePractice } from "@/components/practice-provider";

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

  return (
    <div className={cn("grid gap-3", compact ? "" : "lg:grid-cols-[16rem_minmax(0,1fr)]")}>
      <ul className="grid gap-1">
        {threads.length ? threads.map((thread) => {
          const house = houses.get(thread.householdId);
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => setActiveId(thread.id)}
                className={cn(
                  "flex min-h-12 w-full flex-col items-start rounded-2xl px-3 py-2 text-left text-sm",
                  activeId === thread.id ? "bg-accent text-foreground" : "hover:bg-muted",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate font-medium">{house?.name ?? "Contact"}</span>
                  {thread.unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{thread.unreadCount}</span>
                  ) : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">{channelTypeLabel(thread.channelType)} · {thread.lastPreview || "No preview"}</span>
              </button>
            </li>
          );
        }) : <li className="text-sm text-muted-foreground">No messages yet.</li>}
      </ul>
      {active ? (
        <div className="grid gap-2 rounded-2xl border bg-card p-3">
          <p className="text-sm font-medium text-foreground">{houses.get(active.householdId)?.name ?? "Contact"} · {channelTypeLabel(active.channelType)}</p>
          <ol className="grid max-h-80 gap-2 overflow-y-auto">
            {messages.map((item) => (
              <li key={item.id} className={cn("max-w-[90%] rounded-2xl px-3 py-2 text-sm", item.direction === "out" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                {item.subject ? <p className="text-xs opacity-80">{item.subject}</p> : null}
                <p className="whitespace-pre-wrap">{item.body}</p>
                <p className="mt-1 text-[10px] opacity-70">{new Date(item.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </li>
            ))}
          </ol>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {needsWhatsAppTemplate ? (
            <input className="h-11 rounded-xl border px-3 text-sm" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="WhatsApp template name or Content SID" />
          ) : null}
          <Textarea className="min-h-20" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply on the same channel" />
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
  );
}

export function inboxUnread(threads: MessageThread[]): number {
  return threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
}
