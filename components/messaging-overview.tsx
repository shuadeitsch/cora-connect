"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { requestGmailSync } from "@/components/gmail-inbox-sync";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppData } from "@/lib/types";

type Tone = "ok" | "wait" | "off";

/** "+12079772968" -> "+1 207-977-2968". Anything else is shown as typed. */
export function prettyPhone(value: string | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value ?? "";
}

export function channelStatuses(data: AppData) {
  const setup = data.mailSetup;
  const gmail = data.gmailAccounts?.[0];
  const email: { tone: Tone; text: string } = gmail
    ? gmail.canRead ? { tone: "ok", text: `Connected as ${gmail.email}` } : { tone: "wait", text: `Connected as ${gmail.email}, reconnect to read replies` }
    : setup.resend ? { tone: "ok", text: "Sends from a chabadora.com address (Gmail not connected)" } : { tone: "off", text: "Not connected" };
  const whatsappFrom = prettyPhone(setup.whatsappFrom);
  const whatsapp: { tone: Tone; text: string } = !setup.whatsapp
    ? { tone: "off", text: "Not set up" }
    : setup.whatsappApiSendingEnabled && setup.whatsappTemplateStatus && setup.whatsappTemplateStatus !== "approved"
      ? { tone: "wait", text: "Waiting for WhatsApp template approval" }
      : { tone: "ok", text: `Working${whatsappFrom ? `, sends from ${whatsappFrom}` : ""}` };
  const smsFrom = prettyPhone(setup.smsFrom);
  const texts: { tone: Tone; text: string } = !setup.sms
    ? { tone: "off", text: "Not set up" }
    : setup.smsSendingEnabled ? { tone: "ok", text: `Working${smsFrom ? `, sends from ${smsFrom}` : ""}` } : { tone: "wait", text: "Waiting for carrier approval" };
  const calls: { tone: Tone; text: string } = setup.voice ? { tone: "ok", text: "Working" } : { tone: "off", text: "Not set up" };
  return { email, whatsapp, texts, calls };
}

const DOT: Record<Tone, string> = { ok: "bg-emerald-500", wait: "bg-amber-500", off: "bg-muted-foreground/50" };

/** One compact card per channel: a plain status line, the few actions people use, and everything else behind Details. */
export function ChannelCard({ title, status, actions, children }: { title: string; status: { tone: Tone; text: string }; actions?: ReactNode; children?: ReactNode }) {
  return (
    <section className="panel max-w-2xl rounded-3xl p-4" aria-label={title}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p className="min-w-0 flex-1 text-sm">
          <span className={cn("mr-2 inline-block size-2.5 rounded-full align-middle", DOT[status.tone])} aria-hidden />
          <span className="font-heading text-base font-semibold text-foreground">{title}:</span>{" "}
          <span className="block text-foreground sm:inline">{status.text}</span>
        </p>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? (
        <details className="mt-2 text-sm">
          <summary className="min-h-9 cursor-pointer py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Details</summary>
          <div className="mt-1 grid gap-3 [&_.panel]:mt-0 [&_.panel]:max-w-none [&_.panel]:rounded-2xl [&_.panel]:border [&_.panel]:bg-transparent [&_.panel]:p-3 [&_.panel]:shadow-none">{children}</div>
        </details>
      ) : null}
    </section>
  );
}

export function SyncGmailButton() {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 rounded-full"
      disabled={syncing}
      onClick={() => {
        setSyncing(true);
        void requestGmailSync({ force: true }).then((result) => {
          setSyncing(false);
          if (!result.ok) { toast({ title: result.error || "Could not sync Gmail." }); return; }
          if (result.ingested) { toast({ title: result.ingested === 1 ? "1 new reply synced." : `${result.ingested} new replies synced.`, tone: "ok" }); router.refresh(); }
          else toast({ title: result.accounts ? "Gmail is up to date." : "No connected Gmail inboxes to sync yet.", tone: result.accounts ? "ok" : undefined });
        });
      }}
    >
      {syncing ? "Syncing…" : "Sync now"}
    </Button>
  );
}
