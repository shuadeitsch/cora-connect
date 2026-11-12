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
  GOOGLE_VOICE_MESSAGES_URL,
  googleVoiceCopy,
  isGoogleSender,
  isValidSenderEmail,
  MAILTO_SAFE_LENGTH,
  normalizeSenderEmail,
  openEmailHref,
  outreachPeople,
  phonesForCopy,
  smsHrefWithBody,
  templatesOrDefault,
  whatsappHrefWithText,
  type OutreachMode,
  type OutreachTemplate,
} from "@/lib/outreach";
import { logOutreachSendAction, saveOutreachSenderAction, saveOutreachTextSettingsAction } from "@/lib/actions";
import { usePractice } from "@/components/practice-provider";
import { TWILIO_SETUP_NOTE, TWILIO_SIGNUP_URL } from "@/lib/twilio";
import type { HouseholdView, OutreachSender, OutreachTextSettings, Role, TextFromMode } from "@/lib/types";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function OutreachDialog({
  open,
  mode,
  households,
  role,
  templates,
  senders = [],
  loginEmail = "",
  textSettings = null,
  twilioConnected = false,
  onClose,
}: {
  open: boolean;
  mode: OutreachMode;
  households: HouseholdView[];
  role: Role;
  templates?: OutreachTemplate[];
  senders?: OutreachSender[];
  loginEmail?: string;
  textSettings?: OutreachTextSettings | null;
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
  const [localSenders, setLocalSenders] = useState<OutreachSender[]>([]);
  const [fromEmail, setFromEmail] = useState("");
  const [addingFrom, setAddingFrom] = useState(false);
  const [newFrom, setNewFrom] = useState("");
  const [newFromGoogle, setNewFromGoogle] = useState(false);
  const [textFrom, setTextFrom] = useState<TextFromMode>(textSettings?.textFrom ?? "sms");
  const [voiceNumber, setVoiceNumber] = useState(textSettings?.googleVoiceNumber ?? "");

  const people = useMemo(() => outreachPeople(households), [households]);
  const group = groupFillVars(people);
  const emailList = emailsForCopy(people);
  const phoneList = phonesForCopy(people);
  const template = catalog.find((item) => item.id === templateId) ?? catalog[0]!;
  const savedSenders = useMemo(() => {
    const byEmail = new Map<string, OutreachSender>();
    for (const item of [...senders, ...localSenders]) byEmail.set(item.email.toLowerCase(), item);
    return [...byEmail.values()].sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || a.email.localeCompare(b.email));
  }, [senders, localSenders]);

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
    const preferred = [...senders].sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""))[0];
    setFromEmail(preferred?.email || loginEmail || "");
    setAddingFrom(false);
    setTextFrom(textSettings?.textFrom ?? "sms");
    setVoiceNumber(textSettings?.googleVoiceNumber ?? "");
    // Reset the draft when the dialog opens or the send mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);
  const previewSource = activeMode === "text" ? body : body;
  const previewSubject = fillPlaceholders(subject, group);
  const previewBody = fillPlaceholders(previewSource, group);
  const first = people[0];
  const firstVars = first ? { firstName: first.firstName, state: first.state } : group;
  const firstPreview = first ? fillPlaceholders(previewSource, firstVars) : previewBody;
  const fromSender = savedSenders.find((item) => item.email.toLowerCase() === fromEmail.trim().toLowerCase());
  const openMail = openEmailHref({
    from: fromEmail,
    isGoogle: fromSender?.isGoogle ?? isGoogleSender(fromEmail, false),
    emails: emailList.addresses,
    subject: previewSubject,
    body: previewBody,
  });
  const mailtoLong = openMail.href.length > MAILTO_SAFE_LENGTH;
  const textFromGoogle = textFrom === "google_voice";
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

  function logSend(nextMode: string, recipientCount: number, fromAddress?: string) {
    if (practice.active) return;
    void logOutreachSendAction({
      mode: nextMode,
      templateId: template.id,
      templateName: template.name,
      subject: previewSubject,
      body: previewBody,
      recipientCount,
      fromAddress,
    });
  }

  async function persistTextFrom(next: TextFromMode, number = voiceNumber) {
    setTextFrom(next);
    if (practice.active) return;
    const result = await saveOutreachTextSettingsAction({ textFrom: next, googleVoiceNumber: number });
    if (!result.ok) toast({ title: result.error, tone: "error" });
  }

  async function addSender() {
    const email = normalizeSenderEmail(newFrom || loginEmail);
    if (!isValidSenderEmail(email)) {
      toast({ title: "Enter a valid email address.", tone: "error" });
      return;
    }
    const isGoogle = isGoogleSender(email, newFromGoogle);
    if (practice.active) {
      setLocalSenders((list) => [...list.filter((item) => item.email !== email), {
        id: `local-${email}`,
        orgId: "",
        userId: "",
        email,
        isGoogle,
        lastUsedAt: new Date().toISOString(),
      }]);
      setFromEmail(email);
      setAddingFrom(false);
      setNewFrom("");
      return;
    }
    const result = await saveOutreachSenderAction({ email, isGoogle });
    if (!result.ok) {
      toast({ title: result.error, tone: "error" });
      return;
    }
    setFromEmail(email);
    setAddingFrom(false);
    setNewFrom("");
  }

  async function textWithGoogleVoice(phone: string, message: string) {
    const copied = googleVoiceCopy(phone, message);
    try {
      await copyText(copied);
      toast({ title: "Message copied, paste it in Google Voice" });
    } catch {
      toast({ title: "Copy didn't work. Select the text and copy it yourself.", tone: "error" });
    }
    window.open(GOOGLE_VOICE_MESSAGES_URL, "_blank", "noopener,noreferrer");
    logSend("sms", 1, voiceNumber ? `Google Voice ${voiceNumber}` : "Google Voice");
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
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Send from</span>
              <select
                className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm"
                value={addingFrom ? "__add__" : fromEmail}
                onChange={(event) => {
                  if (event.target.value === "__add__") {
                    setAddingFrom(true);
                    setNewFrom("");
                    setNewFromGoogle(false);
                    return;
                  }
                  setAddingFrom(false);
                  setFromEmail(event.target.value);
                }}
                aria-label="Send from"
              >
                {!fromEmail && !addingFrom ? <option value="">Choose an address</option> : null}
                {loginEmail && !savedSenders.some((item) => item.email.toLowerCase() === loginEmail.toLowerCase()) ? (
                  <option value={loginEmail}>{loginEmail}</option>
                ) : null}
                {savedSenders.map((item) => (
                  <option key={item.id} value={item.email}>{item.email}{isGoogleSender(item.email, item.isGoogle) ? " (Gmail)" : ""}</option>
                ))}
                <option value="__add__">Add an address…</option>
              </select>
            </label>
            {addingFrom ? (
              <div className="grid gap-2 rounded-2xl border p-3">
                <Input
                  type="email"
                  className="h-11"
                  value={newFrom}
                  onChange={(event) => {
                    setNewFrom(event.target.value);
                    if (isGoogleSender(event.target.value, false)) setNewFromGoogle(true);
                  }}
                  placeholder={loginEmail || "you@example.com"}
                  aria-label="New sender address"
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" className="size-4 accent-[#0f766e]" checked={isGoogleSender(newFrom, newFromGoogle)} onChange={(event) => setNewFromGoogle(event.target.checked)} />
                  This is a Gmail or Google Workspace address
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="min-h-11 rounded-full" onClick={() => void addSender()}>Save address</Button>
                  <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => setAddingFrom(false)}>Cancel</Button>
                </div>
              </div>
            ) : null}
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
                  <a href={openMail.href} target={openMail.google ? "_blank" : undefined} rel={openMail.google ? "noreferrer" : undefined} onClick={() => logSend("email", emailList.addresses.length, fromEmail)}>
                    {openMail.google ? "Open in Gmail" : "Open in email app"}
                  </a>
                </Button>
              ) : (
                <Button type="button" className="min-h-11 rounded-full" disabled>{openMail.google ? "Open in Gmail" : "Open in email app"}</Button>
              )}
            </div>
            {fromEmail && !openMail.google ? (
              <p className="text-xs text-muted-foreground">Your mail app will choose the sender; switch to {fromEmail} there.</p>
            ) : null}
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
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Text from</span>
              <select
                className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm"
                value={textFrom}
                onChange={(event) => void persistTextFrom(event.target.value as TextFromMode)}
                aria-label="Text from"
              >
                <option value="sms">Phone&apos;s messaging app</option>
                <option value="google_voice">Google Voice{voiceNumber ? ` ${voiceNumber}` : ""}</option>
              </select>
            </label>
            {textFromGoogle ? (
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Google Voice number</span>
                <Input
                  className="h-11"
                  value={voiceNumber}
                  onChange={(event) => setVoiceNumber(event.target.value)}
                  onBlur={() => void persistTextFrom("google_voice", voiceNumber)}
                  aria-label="Google Voice number"
                  placeholder="(347) 770-1863"
                />
              </label>
            ) : null}
            <p className="text-xs text-muted-foreground">WhatsApp sends from whatever number your WhatsApp is registered to.</p>
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
                        {textFromGoogle ? (
                          <Button type="button" variant="outline" size="sm" className="h-10 rounded-full" onClick={() => void textWithGoogleVoice(phone, filled)}>
                            <MessageSquare className="size-3.5" /> Text
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" className="h-10 rounded-full" asChild>
                            <a href={smsHrefWithBody(phone, filled, platform)} onClick={() => logSend("sms", 1, "Phone's messaging app")}>
                              <MessageSquare className="size-3.5" /> SMS
                            </a>
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" className="h-10 rounded-full" asChild>
                          <a href={whatsappHrefWithText(wa, filled)} target="_blank" rel="noreferrer" onClick={() => logSend("whatsapp", 1, "WhatsApp")}>
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
