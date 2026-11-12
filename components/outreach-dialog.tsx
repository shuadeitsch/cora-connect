"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, MessageCircle, MessageSquare } from "lucide-react";
import { Notice } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  detectSmsPlatform,
  draftFromTemplate,
  emailsForCopy,
  fillPlaceholders,
  groupFillVars,
  MAILTO_SAFE_LENGTH,
  mailtoBccHref,
  outreachPeople,
  phonesForCopy,
  smsHrefWithBody,
  templatesOrDefault,
  whatsappHrefWithText,
  type OutreachMode,
  type OutreachTemplate,
} from "@/lib/outreach";
import { logOutreachSendAction } from "@/lib/actions";
import { usePractice } from "@/components/practice-provider";
import { TWILIO_SETUP_NOTE, TWILIO_SIGNUP_URL } from "@/lib/twilio";
import type { HouseholdView, Role } from "@/lib/types";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function OutreachDialog({
  open,
  mode,
  households,
  role,
  templates,
  twilioConnected = false,
  onClose,
}: {
  open: boolean;
  mode: OutreachMode;
  households: HouseholdView[];
  role: Role;
  templates?: OutreachTemplate[];
  twilioConnected?: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const practice = usePractice();
  const catalog = templatesOrDefault(templates);
  const [templateId, setTemplateId] = useState(catalog[0]!.id);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [activeMode, setActiveMode] = useState<OutreachMode>(mode);

  const people = useMemo(() => outreachPeople(households), [households]);
  const group = groupFillVars(people);
  const emailList = emailsForCopy(people);
  const phoneList = phonesForCopy(people);
  const template = catalog.find((item) => item.id === templateId) ?? catalog[0]!;

  function applyDraft(next: OutreachTemplate, nextMode = activeMode) {
    const draft = draftFromTemplate(next, nextMode, group);
    setTemplateId(next.id);
    setSubject(draft.subject);
    setBody(draft.body);
  }

  useEffect(() => {
    if (!open) return;
    setActiveMode(mode);
    applyDraft(catalog[0]!, mode);
    // Reset the draft when the dialog opens or the send mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);
  const previewSource = activeMode === "text" ? body : body;
  const previewSubject = fillPlaceholders(subject, group);
  const previewBody = fillPlaceholders(previewSource, group);
  const first = people[0];
  const firstVars = first ? { firstName: first.firstName, state: first.state } : group;
  const firstPreview = first ? fillPlaceholders(previewSource, firstVars) : previewBody;
  const mailto = mailtoBccHref({ emails: emailList.addresses, subject: previewSubject, body: previewBody });
  const mailtoLong = mailto.length > MAILTO_SAFE_LENGTH;
  const platform = typeof window === "undefined" ? "other" : detectSmsPlatform();
  const isAdmin = role === "admin";

  function applyTemplate(id: string, nextMode = activeMode) {
    const next = catalog.find((item) => item.id === id) ?? catalog[0]!;
    applyDraft(next, nextMode);
  }

  function switchMode(next: OutreachMode) {
    setActiveMode(next);
    applyTemplate(templateId, next);
  }

  function logSend(nextMode: string, recipientCount: number) {
    if (practice.active) return;
    void logOutreachSendAction({
      mode: nextMode,
      templateId: template.id,
      templateName: template.name,
      subject: previewSubject,
      body: previewBody,
      recipientCount,
    });
  }

  function resetOnOpen(next: boolean) {
    if (!next) onClose();
  }

  async function copy(value: string, ok: string) {
    try {
      await copyText(value);
      toast({ title: ok });
    } catch {
      toast({ title: "Copy didn't work. Select the text and copy it yourself.", tone: "error" });
    }
  }

  function sendThroughTwilio() {
    // Sending is not built. When twilioConnected is true, this click handler will send instead of opening the signup page.
    window.open(TWILIO_SIGNUP_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={resetOnOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">
            {activeMode === "text" ? "Text / WhatsApp" : "Email"} {households.length} contact{households.length === 1 ? "" : "s"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={activeMode === "email" ? "default" : "outline"} className="min-h-11 rounded-full" onClick={() => switchMode("email")}>
            <Mail className="size-3.5" /> Email
          </Button>
          <Button type="button" variant={activeMode === "text" ? "default" : "outline"} className="min-h-11 rounded-full" onClick={() => switchMode("text")}>
            <MessageSquare className="size-3.5" /> Text / WhatsApp
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Template</span>
            <select
              className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm"
              value={templateId}
              onChange={(event) => applyTemplate(event.target.value)}
              aria-label="Message template"
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => applyTemplate(templateId)}>
            Reset to template
          </Button>
        </div>
        {activeMode === "email" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Subject</span>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Email subject" className="h-11 text-base sm:text-sm" />
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Message — edit this one only. The saved template stays as it is.</span>
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} aria-label="Message" className="min-h-32 text-base sm:text-sm" />
        </label>
        {first ? (
          <p className="rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Preview for {first.firstName}</span>
            {first.state ? ` in ${first.state}` : ""}: {activeMode === "email" && subject ? <span className="block text-foreground">{fillPlaceholders(subject, firstVars)}</span> : null}
            {firstPreview}
          </p>
        ) : null}

        {activeMode === "email" ? (
          <div className="grid gap-2">
            {emailList.skipped ? (
              <p className="text-sm text-muted-foreground">
                {emailList.addresses.length} email{emailList.addresses.length === 1 ? "" : "s"} ready. {emailList.skipped} contact{emailList.skipped === 1 ? " has" : "s have"} no email and will be skipped.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {emailList.addresses.length} email{emailList.addresses.length === 1 ? "" : "s"} ready.
              </p>
            )}
            {!emailList.addresses.length ? <Notice>None of these contacts have an email address.</Notice> : null}
            {mailtoLong ? <Notice>This is too long for some email apps. Copy the draft and the addresses, then paste the addresses into BCC.</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => void copy([previewSubject.trim(), previewBody.trim()].filter(Boolean).join("\n\n"), "Draft copied")}>
                Copy draft
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full"
                disabled={!emailList.addresses.length}
                onClick={() => void copy(emailList.addresses.join(", "), emailList.skipped ? `Copied ${emailList.addresses.length} addresses, skipped ${emailList.skipped}` : "Email addresses copied")}
              >
                Copy all email addresses
              </Button>
              {emailList.addresses.length ? (
                <Button type="button" className="min-h-11 rounded-full" asChild>
                  <a href={mailto} onClick={() => logSend("email", emailList.addresses.length)}>Open in email app</a>
                </Button>
              ) : (
                <Button type="button" className="min-h-11 rounded-full" disabled>Open in email app</Button>
              )}
            </div>
            {isAdmin ? <p className="text-xs text-muted-foreground">Send from CRM coming soon.</p> : null}
          </div>
        ) : (
          <div className="grid gap-3">
            {phoneList.skipped ? (
              <p className="text-sm text-muted-foreground">
                {phoneList.numbers.length} number{phoneList.numbers.length === 1 ? "" : "s"} ready. {phoneList.skipped} contact{phoneList.skipped === 1 ? " has" : "s have"} no phone and will be skipped.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {phoneList.numbers.length} number{phoneList.numbers.length === 1 ? "" : "s"} ready.
              </p>
            )}
            {!phoneList.numbers.length ? <Notice>None of these contacts have a phone number.</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => void copy(body, "Message copied")}>
                Copy message
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full"
                disabled={!phoneList.numbers.length}
                onClick={() => void copy(phoneList.numbers.join(", "), phoneList.skipped ? `Copied ${phoneList.numbers.length} numbers, skipped ${phoneList.skipped}` : "Phone numbers copied")}
              >
                Copy all phone numbers
              </Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={sendThroughTwilio}>
                Send through Twilio
              </Button>
            </div>
            {!twilioConnected ? <p className="text-xs text-muted-foreground">{TWILIO_SETUP_NOTE}</p> : null}
            {people.some((row) => row.phones.length) ? (
              <ul className="grid max-h-64 gap-2 overflow-y-auto">
                {people.map((row) => {
                  if (!row.phones.length) return null;
                  const filled = fillPlaceholders(body, { firstName: row.firstName, state: row.state });
                  const phone = row.phones[0]!;
                  const wa = row.waDigits[0]!;
                  return (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{phone}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" className="h-10 rounded-full" asChild>
                          <a href={smsHrefWithBody(phone, filled, platform)} onClick={() => logSend("sms", 1)}>
                            <MessageSquare className="size-3.5" /> SMS
                          </a>
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-10 rounded-full" asChild>
                          <a href={whatsappHrefWithText(wa, filled)} target="_blank" rel="noreferrer" onClick={() => logSend("whatsapp", 1)}>
                            <MessageCircle className="size-3.5" /> WhatsApp
                          </a>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        )}
        <p className="sr-only">Template in use: {template.name}</p>
      </DialogContent>
    </Dialog>
  );
}
