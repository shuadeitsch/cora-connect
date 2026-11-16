"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoToast } from "@/components/undo-toast";
import { recordExternalMessageAction, sendCampaignMessageAction } from "@/lib/actions";
import { defaultStatesOverlap } from "@/lib/messaging";
import { fillPlaceholders, templatesOrDefault } from "@/lib/outreach";
import { whatsappMeLink, whatsappNumberFor } from "@/lib/whatsapp";
import type { AppData, HouseholdView, MessagingChannel, MessagingChannelType, Person, PreplannerEntry } from "@/lib/types";

type Mode = "email" | "text" | "whatsapp";

function personPhone(person: Person) {
  return person.phone.trim() || person.phone2.trim() || person.phone3.trim();
}

function firstAndLast(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return { firstName: first ?? "", lastName: rest.join(" ") };
}

function varsFor(person: Person, house: HouseholdView | undefined) {
  const names = firstAndLast(person.name || house?.name || "");
  return {
    firstName: names.firstName,
    lastName: names.lastName,
    fullName: person.name.trim() || house?.name || "",
    state: house?.state ?? "",
    city: house?.city ?? "",
    address: house?.street ?? "",
    email: person.email.trim(),
    phone: whatsappNumberFor(person) || personPhone(person),
    zip: house?.zip ?? "",
  };
}

function addressFor(mode: Mode, person: Person) {
  if (mode === "email") return person.email.trim();
  if (mode === "whatsapp") return whatsappNumberFor(person);
  return personPhone(person);
}

function optedFor(mode: Mode, person: Person) {
  if (mode === "email") return Boolean(person.emailOptOut);
  if (mode === "whatsapp") return Boolean(person.whatsappOptOut);
  return Boolean(person.smsOptOut);
}

function bodyFromTemplate(mode: Mode, email: string, sms: string) {
  return mode === "email" ? email : sms;
}

function channelTypeFor(mode: Mode): MessagingChannelType {
  if (mode === "email") return "email_gmail";
  if (mode === "whatsapp") return "whatsapp_twilio";
  return "sms_twilio";
}

function scopedChannels(data: AppData): MessagingChannel[] {
  const all = (data.messagingChannels ?? []).filter((item) => item.status === "active");
  if (data.viewer.role === "admin") return all;
  const territory = (data.viewer.territory ?? []).map((row) => row.state.trim().toUpperCase()).filter(Boolean);
  if (!territory.length) return all;
  return all.filter((channel) => !channel.defaultStates.length || channel.defaultStates.some((state) => territory.includes(state.toUpperCase())));
}

function channelFor(channels: MessagingChannel[], type: MessagingChannelType, state: string | undefined) {
  return (
    channels.find((item) => item.type === type && defaultStatesOverlap(item.defaultStates, state))
    ?? channels.find((item) => item.type === type && !item.defaultStates.length)
    ?? channels.find((item) => item.type === type)
  );
}

export function PreplannerMessageDialog({
  open,
  data,
  entries,
  onClose,
}: {
  open: boolean;
  data: AppData;
  entries: PreplannerEntry[];
  onClose: () => void;
}) {
  const announce = useUndoToast();
  const practice = usePractice();
  const catalog = templatesOrDefault(data.outreachTemplates);
  const channels = useMemo(() => scopedChannels(data), [data]);
  const houses = useMemo(() => {
    const map = new Map(data.households.map((house) => [house.id, house]));
    return entries.map((entry) => ({ entry, house: map.get(entry.householdId) })).filter((row) => row.house);
  }, [data.households, entries]);

  const [mode, setMode] = useState<Mode>("email");
  const [templateId, setTemplateId] = useState(catalog[0]?.id ?? "");
  const [subject, setSubject] = useState(catalog[0]?.subject ?? "");
  const [body, setBody] = useState(catalog[0]?.email ?? "");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ name: string; ok: boolean; error?: string }[] | null>(null);
  const [queue, setQueue] = useState<{ person: Person; house: HouseholdView; entry: PreplannerEntry; address: string }[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [pending, start] = useTransition();
  const smsAllowed = Boolean(data.mailSetup?.smsSendingEnabled);
  const smsReady = Boolean(data.mailSetup?.sms && channels.some((item) => item.type === "sms_twilio"));
  const emailReady = Boolean(data.mailSetup?.gmail && channels.some((item) => item.type === "email_gmail" && item.gmailAccountId));
  const whatsappApi = Boolean(data.mailSetup?.whatsappApiSendingEnabled);
  const whatsappApiReady = Boolean(whatsappApi && data.mailSetup?.whatsapp);

  useEffect(() => {
    if (!open) return;
    const tmpl = catalog[0];
    setMode("email");
    setTemplateId(tmpl?.id ?? "");
    setSubject(tmpl?.subject ?? "");
    setBody(tmpl?.email ?? "");
    setError("");
    setResults(null);
    setQueue(null);
    setQueueIndex(0);
    const next: Record<string, boolean> = {};
    for (const { house } of houses) {
      for (const person of house!.people ?? []) {
        if (person.email.trim() && !person.emailOptOut) next[person.id] = true;
      }
    }
    setSelected(next);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when the sheet opens

  const type = channelTypeFor(mode);

  const rows = useMemo(() => {
    const out: {
      person: Person;
      house: HouseholdView;
      entry: PreplannerEntry;
      address: string;
      skip?: string;
    }[] = [];
    for (const { entry, house } of houses) {
      const people = house!.people ?? [];
      if (!people.length) {
        out.push({
          person: { id: `house-${house!.id}`, householdId: house!.id, name: house!.name, gender: null, phone: "", phone2: "", phone3: "", email: "", whatsapp: "", sortOrder: 0 },
          house: house!,
          entry,
          address: "",
          skip: mode === "email" ? "No email on file" : "No phone on file",
        });
        continue;
      }
      for (const person of people) {
        const address = addressFor(mode, person);
        let skip: string | undefined;
        if (optedFor(mode, person)) skip = mode === "email" ? "Opted out of email" : mode === "whatsapp" ? "Opted out of WhatsApp" : "Opted out of texts";
        else if (!address) skip = mode === "email" ? "No email on file" : "No phone on file";
        else if (mode === "whatsapp" && !whatsappMeLink(address, "ok")) skip = "No valid WhatsApp number";
        else if (mode === "email" && !channelFor(channels, type, house!.state)) skip = "No Gmail channel for this state";
        else if (mode === "text" && !channelFor(channels, type, house!.state)) skip = "No texting channel for this state";
        else if (mode === "whatsapp" && whatsappApi && !channelFor(channels, type, house!.state) && !data.mailSetup?.whatsapp) skip = "No WhatsApp channel for this state";
        out.push({ person, house: house!, entry, address, skip });
      }
    }
    return out;
  }, [channels, data.mailSetup?.whatsapp, houses, mode, type, whatsappApi]);

  const ready = rows.filter((row) => !row.skip);
  const skipped = rows.filter((row) => row.skip);
  const chosen = ready.filter((row) => selected[row.person.id]);
  const sample = chosen[0] ?? ready[0];
  const preview = sample ? fillPlaceholders(body, varsFor(sample.person, sample.house)) : body;
  const current = queue?.[queueIndex];
  const currentPreview = current ? fillPlaceholders(body, varsFor(current.person, current.house)) : "";
  const currentLink = current ? whatsappMeLink(current.address, currentPreview) : null;

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const tmpl = catalog.find((item) => item.id === id);
    if (!tmpl) return;
    setSubject(tmpl.subject);
    setBody(bodyFromTemplate(mode, tmpl.email, tmpl.sms));
  }

  function setModeAndBody(next: Mode) {
    setMode(next);
    const tmpl = catalog.find((item) => item.id === templateId);
    if (tmpl) setBody(bodyFromTemplate(next, tmpl.email, tmpl.sms));
    setSelected((current) => {
      const copy: Record<string, boolean> = {};
      for (const { house } of houses) {
        for (const person of house!.people ?? []) {
          const address = addressFor(next, person);
          copy[person.id] = Boolean(address && !optedFor(next, person) && (current[person.id] ?? true));
        }
      }
      return copy;
    });
    setResults(null);
    setQueue(null);
    setError("");
  }

  function startProviderSend() {
    if (mode === "text" && !smsAllowed) {
      setError("Texting turns on once Twilio approves our campaign.");
      return;
    }
    if (!chosen.length) {
      setError("Select at least one person to message.");
      return;
    }
    if (!body.trim() || (mode === "email" && !subject.trim())) {
      setError(mode === "email" ? "Add a subject and a message." : "Write a message, or pick a template.");
      return;
    }
    start(async () => {
      if (practice.active) {
        announce({ ok: true }, "Practice mode — no messages were sent.");
        onClose();
        return;
      }
      setError("");
      const sent: { name: string; ok: boolean; error?: string }[] = [];
      for (const row of chosen) {
        const channel = channelFor(channels, type, row.house.state);
        const filled = fillPlaceholders(body, varsFor(row.person, row.house));
        const filledSubject = mode === "email" ? fillPlaceholders(subject, varsFor(row.person, row.house)) : undefined;
        const result = await sendCampaignMessageAction({
          channelId: channel?.id,
          type,
          to: row.address,
          body: filled,
          subject: filledSubject,
          householdId: row.house.id,
          personId: row.person.id,
          projectId: row.entry.projectId,
          templateId: templateId || undefined,
          templateName: catalog.find((item) => item.id === templateId)?.name,
          preplannerEntryId: row.entry.id,
        });
        sent.push({ name: row.person.name || row.house.name, ok: result.ok, error: result.ok ? undefined : result.error });
      }
      setResults(sent);
      const okCount = sent.filter((item) => item.ok).length;
      if (okCount === sent.length) {
        announce({ ok: true }, okCount === 1 ? "Message sent." : `${okCount} messages sent.`);
      } else {
        announce({ ok: false, error: `${okCount} sent, ${sent.length - okCount} failed.` }, `${okCount} sent, ${sent.length - okCount} failed.`);
      }
    });
  }

  function startWhatsAppQueue() {
    if (!chosen.length) {
      setError("Select at least one person to message.");
      return;
    }
    if (!body.trim()) {
      setError("Write a message, or pick a template.");
      return;
    }
    if (practice.active) {
      announce({ ok: true }, "Practice mode — no messages were sent.");
      return;
    }
    setError("");
    setResults([]);
    setQueue(chosen.map((row) => ({ person: row.person, house: row.house, entry: row.entry, address: row.address })));
    setQueueIndex(0);
  }

  function markWhatsApp(kind: "sent" | "skip") {
    if (!current) return;
    start(async () => {
      const name = current.person.name || current.house.name;
      if (kind === "skip") {
        setResults((list) => [...(list ?? []), { name, ok: false, error: "Skipped" }]);
      } else {
        if (!currentLink) {
          setError("That number is not valid for WhatsApp.");
          return;
        }
        window.open(currentLink, "_blank", "noopener,noreferrer");
        const filled = fillPlaceholders(body, varsFor(current.person, current.house));
        const result = await recordExternalMessageAction({
          type: "whatsapp_twilio",
          to: current.address,
          body: filled,
          householdId: current.house.id,
          personId: current.person.id,
          projectId: current.entry.projectId,
          templateId: templateId || undefined,
          templateName: catalog.find((item) => item.id === templateId)?.name,
          preplannerEntryId: current.entry.id,
          provider: "wa.me",
          channelLabel: "WhatsApp on your phone",
        });
        setResults((list) => [...(list ?? []), { name, ok: result.ok, error: result.ok ? undefined : result.error }]);
      }
      if (queueIndex + 1 >= (queue?.length ?? 0)) {
        setQueue(null);
        announce({ ok: true }, "WhatsApp queue finished.");
      } else {
        setQueueIndex((index) => index + 1);
      }
    });
  }

  function primaryAction() {
    if (mode === "whatsapp" && !whatsappApi) startWhatsAppQueue();
    else startProviderSend();
  }

  const title = results && !queue
    ? "Send results"
    : queue && current
      ? `WhatsApp ${queueIndex + 1} of ${queue.length}`
      : "Message Pre-planner contacts";

  const primaryDisabled =
    pending
    || (mode === "email" && !emailReady)
    || (mode === "text" && (!smsReady || !smsAllowed))
    || (mode === "whatsapp" && whatsappApi && !whatsappApiReady);

  const primaryLabel = pending
    ? "Sending…"
    : mode === "text" && !smsAllowed
      ? "Texting not available yet"
      : mode === "whatsapp" && !whatsappApi
        ? (chosen.length ? `Start WhatsApp queue (${chosen.length})` : "Start WhatsApp queue")
        : chosen.length > 1
          ? `Send ${chosen.length} messages`
          : "Send";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">{title}</DialogTitle>
        </DialogHeader>
        {error ? <Notice>{error}</Notice> : null}

        {queue && current ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Opens WhatsApp for <span className="font-medium text-foreground">{current.person.name || current.house.name}</span>. After you send (or if you skip), we’ll go to the next person.
            </p>
            <p className="text-sm text-muted-foreground">{current.address}</p>
            <p className="whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-sm text-foreground">{currentPreview}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11 rounded-full" disabled={pending || !currentLink} onClick={() => markWhatsApp("sent")}>
                {pending ? "Saving…" : "Send on WhatsApp"}
              </Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={pending} onClick={() => markWhatsApp("skip")}>
                Skip
              </Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={pending} onClick={() => { setQueue(null); }}>
                Back
              </Button>
            </div>
          </div>
        ) : results && !queue ? (
          <div className="grid gap-3">
            <ul className="grid gap-1.5 text-sm">
              {results.map((item, index) => (
                <li key={`${item.name}-${index}`} className={item.ok ? "text-foreground" : "text-red-700"}>
                  {item.ok ? "Sent" : item.error === "Skipped" ? "Skipped" : "Failed"} · {item.name}{item.error && item.error !== "Skipped" ? ` — ${item.error}` : ""}
                </li>
              ))}
            </ul>
            <Button type="button" className="min-h-11 rounded-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <fieldset>
              <legend className="text-sm text-muted-foreground">Send by</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["email", "text", "whatsapp"] as Mode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium ring-1 ${mode === option ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-input"}`}
                    onClick={() => setModeAndBody(option)}
                  >
                    {option === "email" ? "Email" : option === "text" ? "Text" : "WhatsApp"}
                  </button>
                ))}
              </div>
            </fieldset>

            {mode === "email" && !emailReady ? (
              <Notice tone="info">Connect Gmail and link the state’s default Gmail channel in Messaging settings first.</Notice>
            ) : null}
            {mode === "text" && !smsReady ? (
              <Notice tone="info">Add the state’s texting channel in Messaging settings first.</Notice>
            ) : null}
            {mode === "text" ? (
              <Notice tone="info">Texting turns on once Twilio approves our campaign.</Notice>
            ) : null}
            {mode === "whatsapp" && !whatsappApi ? (
              <Notice tone="info">For now this opens WhatsApp on your phone for each person, with the message already filled in. We’ll mark it sent when you tap Send on WhatsApp.</Notice>
            ) : null}
            {mode === "whatsapp" && whatsappApi && !whatsappApiReady ? (
              <Notice tone="info">Twilio WhatsApp is not set up yet. Set TWILIO_WHATSAPP_FROM and an approved Content template, or leave API sending off to use the phone queue.</Notice>
            ) : null}

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Template</span>
              <select
                className="h-11 rounded-xl border bg-card px-3 text-sm"
                value={templateId}
                onChange={(event) => applyTemplate(event.target.value)}
                aria-label="Message template"
              >
                <option value="">Write your own</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            {mode === "email" ? (
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Subject</span>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>
            ) : null}
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Message</span>
              <Textarea className="min-h-28" value={body} onChange={(event) => setBody(event.target.value)} />
              <span className="text-xs text-muted-foreground">Use {"{name}"} or {"{first name}"} to personalize each message.</span>
            </label>
            {sample && body.trim() ? (
              <p className="whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                Preview for {sample.person.name || sample.house.name}: {preview}
              </p>
            ) : null}

            <div className="grid gap-1.5">
              <p className="text-sm font-medium text-foreground">
                Recipients · {chosen.length} selected{skipped.length ? ` · ${skipped.length} skipped` : ""}
              </p>
              <ul className="grid max-h-52 gap-1 overflow-y-auto rounded-2xl border p-2">
                {ready.map((row) => (
                  <li key={`${row.entry.id}-${row.person.id}`}>
                    <label className="flex min-h-11 items-start gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        className="mt-1 size-4"
                        checked={Boolean(selected[row.person.id])}
                        onChange={(event) => setSelected((current) => ({ ...current, [row.person.id]: event.target.checked }))}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{row.person.name || row.house.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{row.address}</span>
                      </span>
                    </label>
                  </li>
                ))}
                {skipped.map((row) => (
                  <li key={`skip-${row.entry.id}-${row.person.id}`} className="px-2 py-1.5 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{row.person.name || row.house.name}</span>
                    <span> — {row.skip}</span>
                  </li>
                ))}
                {!rows.length ? <li className="px-2 py-2 text-sm text-muted-foreground">No contacts in this Pre-planner list.</li> : null}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11 rounded-full" disabled={primaryDisabled} onClick={primaryAction}>
                {primaryLabel}
              </Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={pending} onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
