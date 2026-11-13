"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { disconnectMessagingChannelAction, saveMessagingChannelAction } from "@/lib/actions";
import { channelTypeLabel } from "@/lib/messaging";
import { FOCUS_STATES } from "@/lib/constants";
import type { AppData, MessagingChannelType } from "@/lib/types";
import { useRouter } from "next/navigation";

const STATES = FOCUS_STATES.filter((item) => item.code !== "Unsorted");

export function MessagingChannelsCard({ data }: { data: AppData }) {
  const router = useRouter();
  const setup = data.mailSetup;
  const channels = data.messagingChannels ?? [];
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<MessagingChannelType>("email_resend");
  const [states, setStates] = useState<string[]>([]);
  const [gmailAccountId, setGmailAccountId] = useState(data.gmailAccounts[0]?.id ?? "");
  const admin = data.viewer.role === "admin" && !data.viewer.preview;

  function setupNeeded(kind: MessagingChannelType): string | null {
    if (kind === "email_gmail" && !setup.gmail) return "Setup needed: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Vercel. Redirect URI: https://outreach-crm-brown.vercel.app/api/gmail/callback (and the same path on any custom domain). After connecting, Google must allow gmail.send, gmail.readonly, and gmail.modify. Existing Gmail connections that were send-only need to be connected again to read replies.";
    if (kind === "email_resend" && !setup.resend) return "Setup needed: set RESEND_API_KEY on Vercel.";
    if (kind === "sms_twilio" && !setup.sms) return "Setup needed: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (E.164, like +1…) on Vercel. Optional: TWILIO_PHONE_SID. Paste the SMS webhook into Twilio: https://outreach-crm-brown.vercel.app/api/webhooks/twilio/sms";
    if (kind === "whatsapp_twilio" && !setup.whatsapp) return "Setup needed: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER (whatsapp:+1…) on Vercel. Paste the WhatsApp webhook into Twilio: https://outreach-crm-brown.vercel.app/api/webhooks/twilio/whatsapp";
    return null;
  }

  if (!admin && !channels.length) return null;

  return (
    <section className="panel mt-4 max-w-xl rounded-3xl p-4" aria-label="Messaging channels">
      <h2 className="font-heading text-lg font-semibold text-foreground">Messaging channels</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Start with one dedicated email (maine@chabadora.com) and one dedicated phone number. Admins can connect, disconnect, or swap them, set a default per state, and later add more for other shluchim.
      </p>
      {error ? <div className="mt-2"><Notice>{error}</Notice></div> : null}
      <ul className="mt-3 grid gap-2">
        {channels.length ? channels.map((channel) => (
          <li key={channel.id} className="rounded-2xl border bg-card px-3 py-2">
            <p className="font-medium text-foreground">{channel.label}</p>
            <p className="text-xs text-muted-foreground">{channelTypeLabel(channel.type)} · {channel.address}{channel.defaultStates.length ? ` · Default for ${channel.defaultStates.join(", ")}` : ""}{channel.ownerUserId ? " · Assigned to a shliach" : " · Organization"}</p>
            {admin ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-9 rounded-full" disabled={pending} onClick={() => start(async () => {
                  setAddress(channel.address);
                  setLabel(channel.label);
                  setType(channel.type);
                  setStates(channel.defaultStates);
                  setGmailAccountId(channel.gmailAccountId ?? "");
                })}>Edit / swap</Button>
                <Button type="button" variant="outline" className="h-9 rounded-full" disabled={pending} onClick={() => start(async () => {
                  const result = await disconnectMessagingChannelAction(channel.id);
                  if (!result.ok) setError(result.error);
                  else router.refresh();
                })}>Disconnect</Button>
              </div>
            ) : null}
          </li>
        )) : <li className="text-sm text-muted-foreground">No channels connected yet.</li>}
      </ul>
      {admin ? (
        <form
          className="mt-4 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const needed = setupNeeded(type);
            if (needed) {
              setError(needed);
              return;
            }
            start(async () => {
              setError("");
              const existing = channels.find((item) => item.type === type && item.address.toLowerCase() === address.trim().toLowerCase());
              const result = await saveMessagingChannelAction({
                id: existing?.id,
                type,
                label: label || address,
                address: address || (type === "email_resend" ? "maine@chabadora.com" : ""),
                defaultStates: states,
                gmailAccountId: type === "email_gmail" ? gmailAccountId || null : null,
                domainSenderId: type === "email_resend" ? (data.domainSenders.find((item) => item.email.toLowerCase() === (address || "maine@chabadora.com").toLowerCase())?.id ?? null) : null,
              });
              if (!result.ok) setError(result.error);
              else {
                setLabel("");
                setAddress("");
                router.refresh();
              }
            });
          }}
        >
          <p className="text-sm font-medium text-foreground">Connect or swap a channel</p>
          <select className="h-11 rounded-xl border border-input bg-card px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as MessagingChannelType)} aria-label="Channel type">
            <option value="email_resend">Domain email (Resend)</option>
            <option value="email_gmail">Gmail</option>
            <option value="sms_twilio">Text (Twilio)</option>
            <option value="whatsapp_twilio">WhatsApp (Twilio)</option>
          </select>
          {setupNeeded(type) ? <Notice>{setupNeeded(type)}</Notice> : null}
          <Input placeholder="Label (for example, Maine outreach)" value={label} onChange={(event) => setLabel(event.target.value)} />
          <Input
            placeholder={type.startsWith("email") ? "Sending email (maine@chabadora.com)" : "Sending number (+1…)"}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          {type === "email_gmail" ? (
            data.gmailAccounts.length ? (
              <select className="h-11 rounded-xl border border-input bg-card px-3 text-sm" value={gmailAccountId} onChange={(event) => setGmailAccountId(event.target.value)} aria-label="Connected Gmail account">
                {data.gmailAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.email}{account.canRead ? "" : " (reconnect to read replies)"}</option>
                ))}
              </select>
            ) : (
              <a href="/api/gmail/connect" className="text-sm font-medium text-primary">Connect Gmail</a>
            )
          ) : null}
          {type === "email_resend" && data.domainSenders.length ? (
            <div className="flex flex-wrap gap-1.5">
              {data.domainSenders.map((sender) => (
                <button key={sender.id} type="button" className="h-9 rounded-full border px-3 text-xs" onClick={() => { setAddress(sender.email); setLabel(sender.fromName || sender.email); }}>
                  Use {sender.email}
                </button>
              ))}
            </div>
          ) : null}
          <fieldset className="grid gap-1">
            <legend className="text-xs text-muted-foreground">Default for states</legend>
            <div className="flex flex-wrap gap-2">
              {STATES.map((item) => {
                const checked = states.includes(item.code);
                return (
                  <label key={item.code} className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setStates((current) => current.includes(item.code) ? current.filter((code) => code !== item.code) : [...current, item.code])}
                    />
                    {item.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Button type="submit" className="h-11 rounded-full" disabled={pending || Boolean(setupNeeded(type))}>
            {pending ? "Saving…" : "Save channel"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
