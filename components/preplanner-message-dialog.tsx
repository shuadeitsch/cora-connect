"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoToast } from "@/components/undo-toast";
import { recordExternalMessageAction, sendCampaignBatchAction } from "@/lib/actions";
import { stateLabel } from "@/lib/constants";
import { addressesForFamily, channelFamily, defaultStatesOverlap, withinWhatsAppWindow } from "@/lib/messaging";
import { fillPlaceholders, templatesOrDefault } from "@/lib/outreach";
import { whatsappMeDigits, whatsappMeLink, whatsappNumberFor } from "@/lib/whatsapp";
import type { AppData, HouseholdView, MessagingChannel, MessagingChannelType, Person, PreplannerEntry, WhatsAppContentTemplate } from "@/lib/types";

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

function addressesFor(mode: Mode, person: Person): string[] {
  if (mode === "email") return person.email.trim() ? [person.email.trim()] : [];
  return addressesForFamily(person, mode === "whatsapp" ? "whatsapp" : "sms");
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


function lastWhatsAppInbound(data: AppData, householdId: string, phone: string) {
  const digits = whatsappMeDigits(phone);
  const threads = (data.messageThreads ?? []).filter((thread) => thread.householdId === householdId && channelFamily(thread.channelType) === "whatsapp");
  const match = threads.find((thread) => whatsappMeDigits(thread.contactAddress) === digits) ?? threads[0];
  return match?.lastInboundAt;
}


function fillWhatsAppContent(body: string, first: string) {
  return body.replace(/\{\{\s*1\s*\}\}/g, first);
}

function defaultWhatsAppContentSid(templates: WhatsAppContentTemplate[], fallback?: string) {
  const env = fallback ? templates.find((item) => item.sid === fallback) : undefined;
  if (env?.status === "approved") return env.sid;
  const approved = templates.find((item) => item.status === "approved");
  if (approved) return approved.sid;
  if (env) return env.sid;
  return templates[0]?.sid ?? "";
}

function whatsappStatusLabel(status: WhatsAppContentTemplate["status"]) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Not approved";
  return "Pending Meta approval";
}

type Audience = "all" | "specific";
type Reach = "any" | "new" | "reached";

export function PreplannerMessageDialog({
  open,
  data,
  entries,
  scope = "preplanner",
  initialState,
  onClose,
}: {
  open: boolean;
  data: AppData;
  entries: PreplannerEntry[];
  scope?: "preplanner" | "contacts";
  initialState?: string;
  onClose: () => void;
}) {
  const announce = useUndoToast();
  const practice = usePractice();
  const catalog = templatesOrDefault(data.outreachTemplates);
  const channels = useMemo(() => scopedChannels(data), [data]);
  const baseHouses = useMemo(() => data.households.filter((house) => !house.deletedAt && !house.deletedByShliachAt), [data.households]);
  const states = useMemo(() => [...new Set(baseHouses.map((house) => stateLabel(house.state || "")).filter(Boolean))].sort(), [baseHouses]);
  const entryByHouse = useMemo(() => {
    const map = new Map<string, PreplannerEntry>();
    for (const entry of [...(data.preplannerEntries ?? []), ...entries]) if (!map.has(entry.householdId)) map.set(entry.householdId, entry);
    return map;
  }, [data.preplannerEntries, entries]);
  const reachedIds = useMemo(() => {
    const set = new Set<string>(entryByHouse.keys());
    for (const fact of data.contactedFacts ?? []) set.add(fact.householdId);
    return set;
  }, [data.contactedFacts, entryByHouse]);
  const isAdmin = data.viewer.role === "admin";
  const [audience, setAudience] = useState<Audience>("all");
  const [stateSel, setStateSel] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [cityQuery, setCityQuery] = useState("");
  const [reach, setReach] = useState<Reach>("any");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [pickQuery, setPickQuery] = useState("");
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stateHouses = useMemo(() => (stateSel ? baseHouses.filter((house) => stateLabel(house.state || "") === stateSel) : baseHouses), [baseHouses, stateSel]);
  const cityOptions = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const house of stateHouses) {
      const label = house.city.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const row = counts.get(key) ?? { label, n: 0 };
      row.n += 1;
      counts.set(key, row);
    }
    return [...counts.entries()].map(([key, row]) => ({ key, ...row })).sort((a, b) => a.label.localeCompare(b.label));
  }, [stateHouses]);
  const houses = useMemo(() => {
    let list: HouseholdView[];
    if (audience === "specific") list = baseHouses.filter((house) => picked[house.id]);
    else {
      list = stateHouses;
      if (cities.length) list = list.filter((house) => cities.includes(house.city.trim().toLowerCase()));
      if (reach === "new") list = list.filter((house) => !reachedIds.has(house.id));
      if (reach === "reached") list = list.filter((house) => reachedIds.has(house.id));
    }
    return list.map((house) => ({ entry: entryByHouse.get(house.id), house }));
  }, [audience, baseHouses, cities, entryByHouse, picked, reach, reachedIds, stateHouses]);
  const pickResults = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return [];
    return stateHouses
      .filter((house) => `${house.name} ${house.city} ${house.street} ${(house.people ?? []).map((person) => `${person.name} ${person.phone} ${person.email}`).join(" ")}`.toLowerCase().includes(q))
      .slice(0, 25);
  }, [pickQuery, stateHouses]);

  const [mode, setMode] = useState<Mode>("email");
  const [templateId, setTemplateId] = useState(catalog[0]?.id ?? "");
  const [subject, setSubject] = useState(catalog[0]?.subject ?? "");
  const [body, setBody] = useState(catalog[0]?.email ?? "");
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ name: string; ok: boolean; error?: string }[] | null>(null);
  const [queue, setQueue] = useState<{ person: Person; house: HouseholdView; entry?: PreplannerEntry; address: string }[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [pending, start] = useTransition();
  const smsAllowed = Boolean(data.mailSetup?.smsSendingEnabled);
  const smsReady = Boolean(data.mailSetup?.sms && channels.some((item) => item.type === "sms_twilio"));
  const emailReady = Boolean(data.mailSetup?.gmail && channels.some((item) => item.type === "email_gmail" && item.gmailAccountId));
  const whatsappApi = Boolean(data.mailSetup?.whatsappApiSendingEnabled);
  const whatsappApiReady = Boolean(whatsappApi && data.mailSetup?.whatsapp);
  const waTemplates = data.mailSetup?.whatsappTemplates ?? [];
  const [waContentSid, setWaContentSid] = useState("");

  useEffect(() => {
    if (!open) return;
    const tmpl = catalog[0];
    setMode("email");
    setTemplateId(tmpl?.id ?? "");
    setSubject(tmpl?.subject ?? "");
    setBody(tmpl?.email ?? "");
    setWaContentSid(defaultWhatsAppContentSid(waTemplates, data.mailSetup?.whatsappTemplateSid));
    setError("");
    setResults(null);
    setQueue(null);
    setQueueIndex(0);
    setExcluded({});
    setProgress(null);
    setCities([]);
    setCityQuery("");
    setPicked({});
    setPickQuery("");
    setAudience("all");
    setReach(scope === "preplanner" ? "reached" : "new");
    const terr = (data.viewer.territory ?? []).map((row) => stateLabel(row.state)).filter(Boolean);
    const want = initialState ? stateLabel(initialState) : "";
    setStateSel(isAdmin ? (want && states.includes(want) ? want : states.includes("Maine") ? "Maine" : "") : (terr.find((name) => states.includes(name)) ?? ""));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when the sheet opens

  const type = channelTypeFor(mode);
  const selectedWa = waTemplates.find((item) => item.sid === waContentSid) ?? waTemplates[0];
  const selectedWaApproved = selectedWa?.status === "approved";

  const rows = useMemo(() => {
    const out: {
      rid: string;
      person: Person;
      house: HouseholdView;
      entry?: PreplannerEntry;
      address: string;
      skip?: string;
    }[] = [];
    for (const { entry, house } of houses) {
      const people = house!.people ?? [];
      if (!people.length) {
        out.push({
          rid: `house-${house!.id}|`,
          person: { id: `house-${house!.id}`, householdId: house!.id, name: house!.name, gender: null, phone: "", phone2: "", phone3: "", email: "", whatsapp: "", sortOrder: 0 },
          house: house!,
          entry,
          address: "",
          skip: mode === "email" ? "No email on file" : "No phone on file",
        });
        continue;
      }
      for (const person of people) {
        const addresses = addressesFor(mode, person);
        const targets = addresses.length ? addresses : [""];
        for (const address of targets) {
          let skip: string | undefined;
          if (optedFor(mode, person)) skip = mode === "email" ? "Opted out of email" : mode === "whatsapp" ? "Opted out of WhatsApp" : "Opted out of texts";
          else if (!address) skip = mode === "email" ? "No email on file" : "No phone on file";
          else if (mode === "whatsapp" && !whatsappMeLink(address, "ok")) skip = `${address} is not a valid WhatsApp number`;
          else if (mode === "email" && !channelFor(channels, type, house!.state)) skip = "No Gmail channel for this state";
          else if (mode === "text" && !channelFor(channels, type, house!.state)) skip = "No texting channel for this state";
          else if (mode === "whatsapp" && whatsappApi && !selectedWaApproved && !withinWhatsAppWindow(lastWhatsAppInbound(data, house!.id, address))) skip = selectedWa ? `${selectedWa.label} is waiting for Meta approval (only people who replied in the last 24 hours can get a free-form message)` : "Waiting for WhatsApp template approval (only people who replied in the last 24 hours can get a free-form message)";
          else if (mode === "whatsapp" && whatsappApi && !channelFor(channels, type, house!.state) && !data.mailSetup?.whatsapp) skip = "No WhatsApp channel for this state";
          out.push({ rid: `${person.id}|${address}`, person, house: house!, entry, address, skip });
        }
      }
    }
    return out;
  }, [channels, data, houses, mode, selectedWa, selectedWaApproved, type, whatsappApi, whatsappApiReady]);

  const ready = rows.filter((row) => !row.skip);
  const skipped = rows.filter((row) => row.skip);
  const chosen = ready.filter((row) => !excluded[row.rid]);
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
    if (!chosen.length) {
      setError("No one is selected to message.");
      return;
    }
    const whatsappApproved = mode !== "whatsapp" || selectedWaApproved;
    if (mode === "email" && !subject.trim()) {
      setError("Add a subject and a message.");
      return;
    }
    if ((mode !== "whatsapp" || !whatsappApproved) && !body.trim()) {
      setError("Write a message, or pick a template.");
      return;
    }
    if (mode === "whatsapp" && whatsappApi && !whatsappApproved && !selectedWa) {
      setError("No approved WhatsApp template is available yet. You can only send a free-form message within 24 hours of a contact’s reply.");
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
      setProgress({ done: 0, total: chosen.length });
      setResults([]);
      const BATCH = 5;
      for (let i = 0; i < chosen.length; i += BATCH) {
        const slice = chosen.slice(i, i + BATCH);
        const inputs = slice.map((row) => {
          const channel = channelFor(channels, type, row.house.state);
          const names = varsFor(row.person, row.house);
          const filled = mode === "whatsapp" && selectedWaApproved && selectedWa
            ? fillWhatsAppContent(selectedWa.body, names.firstName || "friend")
            : fillPlaceholders(body, names);
          return {
            channelId: channel?.id,
            type,
            to: row.address,
            body: filled,
            subject: mode === "email" ? fillPlaceholders(subject, names) : undefined,
            householdId: row.house.id,
            personId: row.person.id,
            projectId: row.entry?.projectId ?? undefined,
            templateId: templateId || undefined,
            templateName: mode === "whatsapp" ? (selectedWa?.name || selectedWa?.label) : catalog.find((item) => item.id === templateId)?.name,
            preplannerEntryId: row.entry?.id,
            contentSid: mode === "whatsapp" ? selectedWa?.sid : undefined,
            freeform: mode === "whatsapp" && !selectedWaApproved,
          };
        });
        let batch: { ok: boolean; error?: string }[];
        try {
          const res = await sendCampaignBatchAction(inputs);
          batch = res.ok ? res.results : slice.map(() => ({ ok: false, error: res.error }));
        } catch {
          batch = slice.map(() => ({ ok: false, error: "The connection dropped. Check Inbox before retrying." }));
        }
        slice.forEach((row, index) => sent.push({ name: `${row.person.name || row.house.name}${mode !== "email" && row.address ? ` (${row.address})` : ""}`, ok: batch[index]?.ok ?? false, error: batch[index]?.error }));
        setResults([...sent]);
        setProgress({ done: Math.min(i + BATCH, chosen.length), total: chosen.length });
      }
      setProgress(null);
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
      const name = `${current.person.name || current.house.name} (${current.address})`;
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
          projectId: current.entry?.projectId ?? undefined,
          templateId: templateId || undefined,
          templateName: catalog.find((item) => item.id === templateId)?.name,
          preplannerEntryId: current.entry?.id,
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
    ? (progress ? `Sending ${progress.done} of ${progress.total}…` : "Send results")
    : queue && current
      ? `WhatsApp ${queueIndex + 1} of ${queue.length}`
      : scope === "preplanner" ? "Message contacts" : "Message contacts";

  const primaryDisabled =
    pending
    || (mode === "email" && !emailReady)
    || (mode === "text" && (!smsReady || !smsAllowed))
    || (mode === "whatsapp" && whatsappApi && !whatsappApiReady)
    || (mode === "whatsapp" && whatsappApi && !selectedWaApproved && !body.trim())
    || !chosen.length;

  const primaryLabel = pending
    ? (progress ? `Sending ${progress.done} of ${progress.total}…` : "Sending…")
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
            {mode === "whatsapp" && whatsappApi && whatsappApiReady && !waTemplates.length ? (
              <Notice tone="info">No WhatsApp Content template is configured yet. You can only send a free-form message within 24 hours of a contact’s reply.</Notice>
            ) : null}
            {mode === "whatsapp" && whatsappApi && whatsappApiReady && selectedWa?.status === "approved" ? (
              <Notice tone="ok">WhatsApp will send “{selectedWa.label}” with each person’s name in the greeting.</Notice>
            ) : null}
            {mode === "whatsapp" && whatsappApi && whatsappApiReady && selectedWa?.status === "pending" ? (
              <Notice tone="info">“{selectedWa.label}” is waiting for Meta approval. Until it’s approved, you can only send a free-form message to people who WhatsApp’d you in the last 24 hours.</Notice>
            ) : null}
            {mode === "whatsapp" && whatsappApi && whatsappApiReady && selectedWa?.status === "rejected" ? (
              <Notice>Meta did not approve “{selectedWa.label}”. You can still send a free-form message within 24 hours of a contact’s reply.</Notice>
            ) : null}

            {mode === "whatsapp" && whatsappApi && whatsappApiReady && waTemplates.length ? (
              <fieldset className="grid gap-2">
                <legend className="text-sm text-muted-foreground">WhatsApp template</legend>
                <div className="grid gap-2">
                  {waTemplates.map((item) => {
                    const first = sample ? (varsFor(sample.person, sample.house).firstName || "friend") : "friend";
                    const previewBody = fillWhatsAppContent(item.body, first);
                    const checked = (selectedWa?.sid ?? waContentSid) === item.sid;
                    return (
                      <label
                        key={item.sid}
                        className={`grid cursor-pointer gap-1 rounded-2xl px-3 py-2.5 ring-1 ${checked ? "bg-muted/80 ring-primary" : "bg-card ring-input"}`}
                      >
                        <span className="flex items-start gap-2">
                          <input
                            type="radio"
                            className="mt-1"
                            name="whatsapp-content-template"
                            value={item.sid}
                            checked={checked}
                            onChange={() => setWaContentSid(item.sid)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground">{item.label}</span>
                              <span className={`text-xs ${item.status === "approved" ? "text-emerald-700" : item.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                                {whatsappStatusLabel(item.status)}
                              </span>
                            </span>
                            <span className="block text-xs text-muted-foreground">{item.name}</span>
                          </span>
                        </span>
                        {previewBody ? (
                          <p className="whitespace-pre-wrap pl-6 text-xs text-muted-foreground">
                            {sample ? `Preview for ${sample.person.name || sample.house.name}: ` : null}
                            {previewBody}
                          </p>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            {mode !== "whatsapp" || !whatsappApi || !selectedWaApproved ? (
              <>
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
              </>
            ) : null}

            <fieldset className="grid gap-2 rounded-2xl border p-3">
              <legend className="px-1 text-sm font-medium text-foreground">Who to message</legend>
              {(isAdmin || states.length > 1) ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">State</span>
                  <select className="h-11 rounded-xl border bg-card px-3 text-sm" value={stateSel} onChange={(event) => { setStateSel(event.target.value); setCities([]); }} aria-label="State">
                    {isAdmin ? <option value="">All states</option> : null}
                    {states.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {([["all", `All contacts${stateSel ? ` in ${stateSel}` : ""}`], ["specific", "Specific contacts"]] as const).map(([value, label]) => (
                  <button key={value} type="button" className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium ring-1 ${audience === value ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-input"}`} onClick={() => { setAudience(value); setExcluded({}); }}>
                    {label}
                  </button>
                ))}
              </div>
              {audience === "all" ? (
                <>
                  <div className="grid gap-1">
                    <span className="text-sm text-muted-foreground">Cities{cities.length ? ` · ${cities.length} chosen` : " · all"}</span>
                    <Input value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} placeholder="Find a city" aria-label="Find a city" />
                    <div className="grid max-h-36 gap-0.5 overflow-y-auto rounded-xl border p-1.5">
                      {cityOptions.filter((row) => !cityQuery.trim() || row.label.toLowerCase().includes(cityQuery.trim().toLowerCase())).map((row) => (
                        <label key={row.key} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
                          <input type="checkbox" className="size-4" checked={cities.includes(row.key)} onChange={(event) => { setCities((list) => event.target.checked ? [...list, row.key] : list.filter((key) => key !== row.key)); setExcluded({}); }} />
                          <span className="flex-1">{row.label}</span>
                          <span className="text-xs text-muted-foreground">{row.n}</span>
                        </label>
                      ))}
                      {!cityOptions.length ? <span className="px-2 py-1 text-xs text-muted-foreground">No cities on file.</span> : null}
                    </div>
                    {cities.length ? <button type="button" className="justify-self-start text-xs text-primary underline" onClick={() => { setCities([]); setExcluded({}); }}>Clear cities</button> : null}
                  </div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Already reached out">
                    {([["any", "Everyone"], ["new", "Not reached out yet"], ["reached", "Already reached out"]] as const).map(([value, label]) => (
                      <button key={value} type="button" role="radio" aria-checked={reach === value} className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium ring-1 ${reach === value ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-input"}`} onClick={() => { setReach(value); setExcluded({}); }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">“Already reached out” means in the Pre-planner or messaged from here.</p>
                </>
              ) : (
                <div className="grid gap-1">
                  <Input value={pickQuery} onChange={(event) => setPickQuery(event.target.value)} placeholder="Search name, city, phone or email" aria-label="Search contacts" />
                  {pickResults.length ? (
                    <ul className="grid max-h-36 gap-0.5 overflow-y-auto rounded-xl border p-1.5">
                      {pickResults.map((house) => (
                        <li key={house.id}>
                          <label className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
                            <input type="checkbox" className="size-4" checked={Boolean(picked[house.id])} onChange={(event) => { setPicked((current) => ({ ...current, [house.id]: event.target.checked })); setExcluded({}); }} />
                            <span className="flex-1">{house.name}</span>
                            <span className="text-xs text-muted-foreground">{house.city}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{Object.values(picked).filter(Boolean).length} picked</p>
                </div>
              )}
            </fieldset>

            <div className="grid gap-1.5">
              <p className="text-sm font-medium text-foreground">
                Recipients · {chosen.length} selected{skipped.length ? ` · ${skipped.length} skipped` : ""}
              </p>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-primary underline" onClick={() => setExcluded({})}>Select all</button>
                <button type="button" className="text-primary underline" onClick={() => setExcluded(Object.fromEntries(ready.map((row) => [row.rid, true])))}>Clear all</button>
              </div>
              <ul className="grid max-h-52 gap-1 overflow-y-auto rounded-2xl border p-2">
                {ready.slice(0, 300).map((row) => (
                  <li key={row.rid}>
                    <label className="flex min-h-11 items-start gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        className="mt-1 size-4"
                        checked={!excluded[row.rid]}
                        onChange={(event) => setExcluded((current) => ({ ...current, [row.rid]: !event.target.checked }))}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{row.person.name || row.house.name}{mode !== "email" && row.address ? <span className="font-normal text-muted-foreground"> · {row.address}</span> : null}</span>
                        <span className="block truncate text-xs text-muted-foreground">{row.address}</span>
                      </span>
                    </label>
                  </li>
                ))}
                {ready.length > 300 ? <li className="px-2 py-1.5 text-xs text-muted-foreground">Showing the first 300 of {ready.length}. Everyone checked is included.</li> : null}
                {skipped.slice(0, 200).map((row) => (
                  <li key={`skip-${row.rid}`} className="px-2 py-1.5 text-sm text-muted-foreground">
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
