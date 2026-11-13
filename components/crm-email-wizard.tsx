"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoToast } from "@/components/undo-toast";
import { sendOutreachEmailAction } from "@/lib/actions";
import { emailRecipientsFor, templatesOrDefault, type OutreachTemplate } from "@/lib/outreach";
import type { DomainSender, GmailAccount, HouseholdView, MailSetup } from "@/lib/types";

type Method = "gmail" | "resend";
type Result = { key: string; name: string; email: string; ok: boolean; error?: string };

export function CrmEmailWizard({
  open,
  households,
  templates,
  gmailAccounts,
  domainSenders,
  mailSetup,
  isAdmin,
  onClose,
}: {
  open: boolean;
  households: HouseholdView[];
  templates?: OutreachTemplate[];
  gmailAccounts: GmailAccount[];
  domainSenders: DomainSender[];
  mailSetup: MailSetup;
  isAdmin?: boolean;
  onClose: () => void;
}) {
  const announce = useUndoToast();
  const practice = usePractice();
  const catalog = templatesOrDefault(templates);
  const [step, setStep] = useState<"setup" | "preview" | "confirm" | "sending" | "done">("setup");
  const [templateId, setTemplateId] = useState(catalog[0]?.id ?? "");
  const [method, setMethod] = useState<Method | "">("");
  const [gmailAccountId, setGmailAccountId] = useState(gmailAccounts[0]?.id ?? "");
  const [domainId, setDomainId] = useState(domainSenders[0]?.id ?? "");
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<ReturnType<typeof emailRecipientsFor>["ready"]>([]);
  const [skippedNoEmail, setSkippedNoEmail] = useState(0);
  const [skippedOptedOut, setSkippedOptedOut] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const template = catalog.find((item) => item.id === templateId) ?? catalog[0];
  const gmailReady = Boolean(mailSetup.gmail && gmailAccounts.length);
  const resendReady = Boolean(mailSetup.resend && domainSenders.length);
  const fromGmail = gmailAccounts.find((item) => item.id === gmailAccountId);
  const fromDomain = domainSenders.find((item) => item.id === domainId) ?? domainSenders[0];

  useEffect(() => {
    if (!open) return;
    const first = catalog[0];
    setTemplateId(first?.id ?? "");
    const built = first ? emailRecipientsFor(households, first) : { ready: [], skippedNoEmail: 0, skippedOptedOut: 0 };
    setDrafts(built.ready);
    setSkippedNoEmail(built.skippedNoEmail);
    setSkippedOptedOut(built.skippedOptedOut);
    setIndex(0);
    setResults([]);
    setError("");
    setStep("setup");
    setGmailAccountId(gmailAccounts[0]?.id ?? "");
    setDomainId(domainSenders[0]?.id ?? "");
    if (mailSetup.gmail && gmailAccounts.length) setMethod("gmail");
    else if (mailSetup.resend && domainSenders.length) setMethod("resend");
    else setMethod("");
  }, [open]); // reset when the wizard opens

  function rebuild(nextId: string) {
    const next = catalog.find((item) => item.id === nextId) ?? catalog[0];
    if (!next) return;
    setTemplateId(nextId);
    const built = emailRecipientsFor(households, next);
    setDrafts(built.ready);
    setSkippedNoEmail(built.skippedNoEmail);
    setSkippedOptedOut(built.skippedOptedOut);
    setIndex(0);
  }

  const current = drafts[index];
  const fromAddress = method === "gmail" ? fromGmail?.email ?? "" : fromDomain?.email ?? "";
  const fromName = method === "resend" ? fromDomain?.fromName ?? "" : "";

  async function sendAll() {
    if (practice.active) {
      announce({ ok: true }, "Would send in the live CRM, not in practice mode");
      onClose();
      return;
    }
    if (!method || !fromAddress) {
      setError("Pick a sending method and a From address.");
      return;
    }
    setStep("sending");
    setResults([]);
    const out: Result[] = [];
    for (const draft of drafts) {
      const result = await sendOutreachEmailAction({
        method,
        fromAddress,
        fromName,
        gmailAccountId: method === "gmail" ? gmailAccountId : undefined,
        to: draft.email,
        subject: draft.subject,
        body: draft.body,
        householdId: draft.householdId,
        personId: draft.personId,
        templateId: template?.id,
        templateName: template?.name,
      });
      out.push({ key: draft.key, name: draft.name, email: draft.email, ok: result.ok, error: result.ok ? undefined : result.error });
      setResults([...out]);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    setStep("done");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">
            {step === "done" ? "Send results" : step === "sending" ? "Sending…" : step === "confirm" ? "Confirm send" : step === "preview" ? "Preview each email" : "Send from CRM"}
          </DialogTitle>
        </DialogHeader>

        {step === "setup" ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Template</span>
              <select className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm" value={templateId} onChange={(event) => rebuild(event.target.value)} aria-label="Message template">
                {catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <fieldset className="grid gap-2">
              <legend className="text-sm text-muted-foreground">Send with</legend>
              <label className="flex min-h-11 items-center gap-2 rounded-2xl border px-3 text-sm">
                <input type="radio" name="crm-send-method" checked={method === "gmail"} disabled={!gmailReady} onChange={() => setMethod("gmail")} />
                Gmail (from your connected account)
                {!mailSetup.gmail ? <span className="text-xs text-muted-foreground">Setup needed</span> : !gmailAccounts.length ? <span className="text-xs text-muted-foreground">Connect Gmail in Settings</span> : null}
              </label>
              {method === "gmail" && gmailAccounts.length ? (
                <select className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm" value={gmailAccountId} onChange={(event) => setGmailAccountId(event.target.value)} aria-label="Gmail account">
                  {gmailAccounts.map((item) => <option key={item.id} value={item.id}>{item.email}</option>)}
                </select>
              ) : null}
              <label className="flex min-h-11 items-center gap-2 rounded-2xl border px-3 text-sm">
                <input type="radio" name="crm-send-method" checked={method === "resend"} disabled={!resendReady} onChange={() => setMethod("resend")} />
                Domain email (e.g. info@ or maine@chabadora.com)
                {!mailSetup.resend ? <span className="text-xs text-muted-foreground">Setup needed</span> : !domainSenders.length ? <span className="text-xs text-muted-foreground">Add a From address in Settings</span> : null}
              </label>
              {method === "resend" && domainSenders.length ? (
                <select className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm" value={fromDomain?.id ?? ""} onChange={(event) => setDomainId(event.target.value)} aria-label="Domain From address">
                  {domainSenders.map((item) => <option key={item.id} value={item.id}>{item.fromName ? `${item.fromName} <${item.email}>` : item.email}</option>)}
                </select>
              ) : null}
            </fieldset>
            {!mailSetup.gmail && isAdmin ? (
              <Notice>Connect Gmail needs a Google Cloud OAuth client (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) in Vercel. An admin can add those in the project env vars.</Notice>
            ) : null}
            {!mailSetup.resend && isAdmin ? (
              <Notice>Domain sending needs RESEND_API_KEY in Vercel, and the chabadora.com DNS records in Resend.</Notice>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {drafts.length} email{drafts.length === 1 ? "" : "s"} ready.
              {skippedNoEmail ? ` ${skippedNoEmail} contact${skippedNoEmail === 1 ? " has" : "s have"} no email and will be skipped.` : ""}
              {skippedOptedOut ? ` ${skippedOptedOut} opted out and will be skipped.` : ""}
            </p>
            {!drafts.length ? <Notice>No one in this selection can be emailed.</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11 rounded-full" disabled={!drafts.length || !method} onClick={() => setStep("preview")}>Preview emails</Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        ) : null}

        {step === "preview" && current ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {index + 1} of {drafts.length}: {current.name} ({current.email})
            </p>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Subject</span>
              <Input className="h-11" value={current.subject} onChange={(event) => setDrafts((list) => list.map((item, i) => i === index ? { ...item, subject: event.target.value } : item))} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Message</span>
              <Textarea className="min-h-36" value={current.body} onChange={(event) => setDrafts((list) => list.map((item, i) => i === index ? { ...item, body: event.target.value } : item))} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={index >= drafts.length - 1} onClick={() => setIndex((value) => Math.min(drafts.length - 1, value + 1))}>Next</Button>
              <Button type="button" className="min-h-11 rounded-full" onClick={() => setStep("confirm")}>Continue</Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setStep("setup")}>Back</Button>
            </div>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div className="grid gap-3">
            <p className="text-sm text-foreground">
              Send {drafts.length} separate email{drafts.length === 1 ? "" : "s"} from {fromName ? `${fromName} <${fromAddress}>` : fromAddress} with {method === "gmail" ? "Gmail" : "domain email"}?
            </p>
            <p className="text-sm text-muted-foreground">Each person gets their own message. No shared To or CC.</p>
            {skippedNoEmail || skippedOptedOut ? (
              <p className="text-sm text-muted-foreground">
                {skippedNoEmail ? `${skippedNoEmail} without an email skipped. ` : ""}
                {skippedOptedOut ? `${skippedOptedOut} opted out skipped.` : ""}
              </p>
            ) : null}
            {error ? <Notice>{error}</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11 rounded-full" disabled={pending} onClick={() => start(() => sendAll())}>Send</Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setStep("preview")}>Back</Button>
            </div>
          </div>
        ) : null}

        {step === "sending" || step === "done" ? (
          <div className="grid gap-3">
            <p className="text-sm text-foreground">
              {results.filter((item) => item.ok).length} sent
              {results.some((item) => !item.ok) ? `, ${results.filter((item) => !item.ok).length} failed` : ""}
              {step === "sending" ? ` · ${results.length} of ${drafts.length}` : ""}
            </p>
            <ul className="grid max-h-64 gap-1 overflow-y-auto text-sm">
              {results.map((item) => (
                <li key={item.key} className={item.ok ? "text-foreground" : "text-red-600"}>
                  {item.name} ({item.email}): {item.ok ? "Sent" : item.error || "Failed"}
                </li>
              ))}
            </ul>
            {step === "done" ? (
              <Button type="button" className="min-h-11 rounded-full" onClick={onClose}>Done</Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
