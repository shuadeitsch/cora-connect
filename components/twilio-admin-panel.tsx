"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTwilioPaymentAction, removeTwilioPaymentAction, saveTopupSettingsAction } from "@/lib/twilio-admin-actions";
import type { PaymentRow, TopupSettings, TwilioLive, UsageLine, UsagePeriod } from "@/lib/twilio-admin";

export type TwilioPayload = {
  live: TwilioLive;
  estimate: { perDay: number | null; days: number | null };
  settings: TopupSettings;
  payments: PaymentRow[];
  error?: string;
};

const usd = (n: number, digits = 2) => `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const num = (n: number) => Math.round(n).toLocaleString("en-US");

function Live() {
  return <span className="rounded-full bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Live from Twilio</span>;
}
function Manual() {
  return <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">Entered by hand</span>;
}

function lastText(estimate: TwilioPayload["estimate"], balance: number | null) {
  if (balance == null) return "Unknown";
  if (estimate.days == null) return "Not enough spending this month to estimate";
  if (estimate.days > 730) return `about ${Math.round(estimate.days / 365)} years`;
  if (estimate.days > 60) return `about ${Math.round(estimate.days / 30)} months`;
  return `about ${estimate.days} day${estimate.days === 1 ? "" : "s"}`;
}

function UsageRows({ month, all }: { month: UsagePeriod | null; all: UsagePeriod | null }) {
  const rows: { label: string; pick: (p: UsagePeriod) => UsageLine; amount: (l: UsageLine) => string }[] = [
    { label: "Voice calls", pick: (p) => p.calls, amount: (l) => `${num(l.usage)} min` },
    { label: "Texts (SMS)", pick: (p) => p.sms, amount: (l) => `${num(l.count)} texts` },
    { label: "WhatsApp", pick: (p) => p.whatsapp, amount: (l) => `${num(l.count)} messages` },
    { label: "Recordings", pick: (p) => p.recordings, amount: (l) => `${num(l.usage)} min` },
    { label: "Phone numbers", pick: (p) => p.phoneNumbers, amount: (l) => `${num(l.count)}` },
  ];
  const cell = (p: UsagePeriod | null, row: (typeof rows)[number]) => {
    if (!p) return "—";
    const l = row.pick(p);
    return <><span className="text-foreground">{row.amount(l)}</span> · {usd(l.price)}</>;
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground"><th className="py-1 pr-2 font-medium">Usage</th><th className="py-1 pr-2 font-medium">This month</th><th className="py-1 font-medium">All time</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border/60">
              <td className="py-1.5 pr-2 font-medium text-foreground">{row.label}</td>
              <td className="py-1.5 pr-2 text-muted-foreground">{cell(month, row)}</td>
              <td className="py-1.5 text-muted-foreground">{cell(all, row)}</td>
            </tr>
          ))}
          <tr className="border-t border-border font-semibold text-foreground">
            <td className="py-1.5 pr-2">Total charged</td>
            <td className="py-1.5 pr-2">{month ? usd(month.total) : "—"}</td>
            <td className="py-1.5">{all ? usd(all.total) : "—"}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted-foreground">Total charged also includes lookups, registration fees and anything else Twilio bills.</p>
    </div>
  );
}

export function TwilioPanelBody({ payload, onChanged, readOnly = false }: { payload: TwilioPayload; onChanged: () => void; readOnly?: boolean }) {
  const { live, estimate, settings, payments } = payload;
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [enabled, setEnabled] = useState(settings.enabled);
  const [threshold, setThreshold] = useState(settings.threshold == null ? "" : String(settings.threshold));
  const [amount, setAmount] = useState(settings.amount == null ? "" : String(settings.amount));
  const [paidOn, setPaidOn] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  const [payAmount, setPayAmount] = useState("");
  const [note, setNote] = useState("");
  const low = live.balance != null && enabled && threshold !== "" && live.balance <= Number(threshold);
  const paidTotal = payments.reduce((sum, row) => sum + row.amount, 0);
  const run = (work: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setMsg("");
    start(async () => {
      const result = await work();
      if (!result.ok) { setMsg(result.error ?? "Couldn't save."); return; }
      after?.();
      onChanged();
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Balance left <Live /></p>
          <p className={`font-heading text-2xl font-semibold ${low ? "text-red-600" : "text-foreground"}`}>{live.balance == null ? "—" : usd(live.balance)}</p>
          {low ? <p className="text-xs text-red-600">At or below your top-up threshold.</p> : null}
        </div>
        <div className="rounded-2xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Spent this month <Live /></p>
          <p className="font-heading text-2xl font-semibold text-foreground">{live.thisMonth ? usd(live.thisMonth.total) : "—"}</p>
        </div>
        <div className="rounded-2xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Balance should last <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">Estimate</span></p>
          <p className="text-base font-semibold text-foreground">{lastText(estimate, live.balance)}</p>
          <p className="text-xs text-muted-foreground">{estimate.perDay != null ? `Pace ${usd(estimate.perDay, 3)}/day this month, one-time fees left out. ` : ""}Rough guess; ignores auto top-up.</p>
        </div>
      </div>

      <UsageRows month={live.thisMonth} all={live.allTime} />
      {live.errors.length ? <p role="alert" className="text-sm text-red-600">Some Twilio numbers couldn&apos;t load ({live.errors.join("; ")}).</p> : null}
      {payload.error ? <p role="alert" className="text-sm text-red-600">{payload.error}</p> : null}

      <section className="grid gap-2 rounded-2xl border border-border p-3">
        <h3 className="text-sm font-semibold">Auto top-up settings <Manual /></h3>
        <p className="text-xs text-muted-foreground">Twilio doesn&apos;t share its auto-recharge settings, so copy them from the Twilio console. This is a note here only and changes nothing at Twilio.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={enabled} disabled={readOnly} onChange={(event) => setEnabled(event.target.checked)} /> Auto top-up is on</label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">When the balance reaches ($)
            <Input inputMode="decimal" className="h-10 w-28" value={threshold} disabled={readOnly} onChange={(event) => setThreshold(event.target.value)} aria-label="Top-up threshold" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">Recharge by ($)
            <Input inputMode="decimal" className="h-10 w-28" value={amount} disabled={readOnly} onChange={(event) => setAmount(event.target.value)} aria-label="Top-up amount" />
          </label>
          <Button type="button" className="h-10 rounded-full" disabled={pending || readOnly} onClick={() => run(() => saveTopupSettingsAction({ enabled, threshold: threshold.trim() === "" ? null : Number(threshold), amount: amount.trim() === "" ? null : Number(amount) }))}>Save</Button>
        </div>
        {enabled && threshold && amount ? <p className="text-sm text-foreground">When the balance reaches {usd(Number(threshold))}, it recharges by {usd(Number(amount))}.</p> : null}
      </section>

      <section className="grid gap-2 rounded-2xl border border-border p-3">
        <h3 className="text-sm font-semibold">Payments <Manual /></h3>
        <p className="text-xs text-muted-foreground">Twilio doesn&apos;t share payment history either. Add each recharge here ({usd(paidTotal)} logged so far).</p>
        <div className="flex flex-wrap items-end gap-2">
          <Input type="date" className="h-10 w-40" value={paidOn} disabled={readOnly} onChange={(event) => setPaidOn(event.target.value)} aria-label="Date paid" />
          <Input inputMode="decimal" className="h-10 w-24" placeholder="$ amount" value={payAmount} disabled={readOnly} onChange={(event) => setPayAmount(event.target.value)} aria-label="Amount paid" />
          <Input className="h-10 min-w-0 flex-1" placeholder="Note (optional)" value={note} disabled={readOnly} onChange={(event) => setNote(event.target.value)} aria-label="Payment note" />
          <Button type="button" className="h-10 rounded-full" disabled={pending || readOnly} onClick={() => run(() => addTwilioPaymentAction({ paidOn, amount: Number(payAmount), note }), () => { setPayAmount(""); setNote(""); })}>Add</Button>
        </div>
        {payments.length ? (
          <ul className="divide-y divide-border/60 text-sm">
            {payments.map((row) => (
              <li key={row.id} className="flex items-center gap-2 py-1.5">
                <span className="w-24 shrink-0 text-muted-foreground">{row.paidOn}</span>
                <span className="w-20 shrink-0 font-medium text-foreground">{usd(row.amount)}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.note}</span>
                <button type="button" className="min-h-9 rounded-full px-2 text-xs text-red-600 hover:bg-muted" disabled={pending || readOnly} onClick={() => run(() => removeTwilioPaymentAction(row.id))}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No payments logged yet.</p>}
      </section>
      {msg ? <p role="alert" className="text-sm text-red-600">{msg}</p> : null}
      <p className="text-xs text-muted-foreground">Twilio numbers as of {new Date(live.fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET, refreshed about every 5 minutes.</p>
    </div>
  );
}

/** Rendered by the server only for admins; fetches from the admin-only API route. */
export function TwilioAdminPanel() {
  const [payload, setPayload] = useState<TwilioPayload | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/twilio", { cache: "no-store" });
      if (!response.ok) { setError(response.status === 403 ? "Admins only." : "Couldn't load Twilio."); return; }
      setPayload((await response.json()) as TwilioPayload);
      setError("");
    } catch {
      setError("Couldn't load Twilio.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <details className="mb-4 rounded-3xl border border-border bg-card p-4">
      <summary className="cursor-pointer font-heading text-base font-semibold">Twilio <span className="text-xs font-normal text-muted-foreground">· admin only</span></summary>
      <div className="mt-3">
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : payload ? <TwilioPanelBody payload={payload} onChanged={() => void load()} /> : <p className="text-sm text-muted-foreground">Loading Twilio…</p>}
      </div>
    </details>
  );
}
