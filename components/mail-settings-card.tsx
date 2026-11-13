"use client";

import { useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUndoToast } from "@/components/undo-toast";
import { deleteDomainSenderAction, disconnectGmailAccountAction, saveDomainSenderAction } from "@/lib/actions";
import { isValidSenderEmail, normalizeSenderEmail } from "@/lib/outreach";
import type { DomainSender, GmailAccount, MailSetup } from "@/lib/types";

export function MailSettingsCard({
  gmailAccounts,
  domainSenders,
  mailSetup,
  canManage,
}: {
  gmailAccounts: GmailAccount[];
  domainSenders: DomainSender[];
  mailSetup: MailSetup;
  canManage: boolean;
}) {
  const announce = useUndoToast();
  const practice = usePractice();
  const [email, setEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <section className="mt-4 grid max-w-2xl gap-4 panel rounded-3xl p-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Send from CRM</h2>
        <p className="text-sm text-muted-foreground">
          Connect one or more Google accounts to send through Gmail (it lands in that account&apos;s Sent folder), or send from a chabadora.com address. Beta and Tutorial never send.
        </p>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-medium text-foreground">Gmail accounts</h3>
        <ul className="grid gap-2">
          {gmailAccounts.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
              <p className="truncate font-medium text-foreground">{item.email}</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full"
                disabled={pending}
                onClick={() => start(async () => {
                  if (practice.active) {
                    announce({ ok: true }, "Disconnected in practice mode");
                    return;
                  }
                  const result = await disconnectGmailAccountAction(item.id);
                  if (!result.ok) { setError(result.error); return; }
                  announce(result, "Gmail disconnected");
                })}
              >
                Disconnect
              </Button>
            </li>
          ))}
          {!gmailAccounts.length ? <li className="text-sm text-muted-foreground">No Google accounts connected yet.</li> : null}
        </ul>
        {mailSetup.gmail ? (
          <Button type="button" className="min-h-11 w-fit rounded-full" asChild>
            <a href="/api/gmail/connect">Connect Gmail</a>
          </Button>
        ) : (
          <div className="grid gap-1">
            <Button type="button" className="min-h-11 w-fit rounded-full" disabled>Connect Gmail</Button>
            {canManage ? (
              <Notice>Setup needed: add a Google Cloud OAuth client with gmail.send, gmail.readonly, and gmail.modify, then set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the Vercel project (production, preview, and development). Redirect URI: https://outreach-crm-brown.vercel.app/api/gmail/callback (and the same path on any custom domain). Already-connected send-only accounts must Connect again to read replies.</Notice>
            ) : (
              <p className="text-sm text-muted-foreground">Gmail sending is not set up yet. An admin can add the Google client in Vercel.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-medium text-foreground">Domain From addresses</h3>
        <p className="text-sm text-muted-foreground">Used when sending through the domain (Resend). info@chabadora.com and maine@chabadora.com are included; admins can add more.</p>
        {!mailSetup.resend ? (
          canManage ? (
            <Notice>Setup needed: set RESEND_API_KEY on the Vercel project, and add the chabadora.com domain in Resend with the DNS records Resend shows (SPF, DKIM, and domain verification).</Notice>
          ) : (
            <p className="text-sm text-muted-foreground">Domain sending is not set up yet. An admin can add the Resend key in Vercel.</p>
          )
        ) : null}
        <ul className="grid gap-2">
          {domainSenders.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{item.fromName ? `${item.fromName} ` : ""}{item.email}</p>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full"
                  disabled={pending}
                  onClick={() => start(async () => {
                    if (practice.active) { announce({ ok: true }, "Removed in practice mode"); return; }
                    const result = await deleteDomainSenderAction(item.id);
                    if (!result.ok) { setError(result.error); return; }
                    announce(result, "Sender removed");
                  })}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canManage ? (
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = normalizeSenderEmail(email);
              if (!isValidSenderEmail(value)) { setError("Enter a valid From address."); return; }
              start(async () => {
                if (practice.active) { announce({ ok: true }, "Saved in practice mode"); setEmail(""); setFromName(""); return; }
                const result = await saveDomainSenderAction({ email: value, fromName });
                if (!result.ok) { setError(result.error); return; }
                announce(result, "Sender saved");
                setEmail("");
                setFromName("");
                setError("");
              });
            }}
          >
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">From name</span>
              <Input className="h-11" value={fromName} onChange={(event) => setFromName(event.target.value)} placeholder="Chabad of Maine" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">From address</span>
              <Input type="email" className="h-11" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="office@chabadora.com" />
            </label>
            <Button type="submit" className="min-h-11 rounded-full sm:col-span-2" disabled={pending}>Add domain sender</Button>
          </form>
        ) : null}
      </div>
      {error ? <Notice>{error}</Notice> : null}
    </section>
  );
}
