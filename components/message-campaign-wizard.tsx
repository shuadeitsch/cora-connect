"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoToast } from "@/components/undo-toast";
import { sendCampaignMessageAction } from "@/lib/actions";
import { defaultStatesOverlap, planCampaignAudience, channelFamily, channelTypeLabel, withinWhatsAppWindow, type MessageFamily } from "@/lib/messaging";
import { fillPlaceholders, templatesOrDefault } from "@/lib/outreach";
import { defaultPreplannerProjectId } from "@/lib/preplanner";
import type { AppData, HouseholdView, MessagingChannelType } from "@/lib/types";

type Step = "setup" | "preview" | "confirm" | "sending" | "done";

export function MessageCampaignWizard({
  open,
  households,
  data,
  projectId,
  state,
  onClose,
}: {
  open: boolean;
  households: HouseholdView[];
  data: AppData;
  projectId?: string | null;
  state?: string | null;
  onClose: () => void;
}) {
  const announce = useUndoToast();
  const practice = usePractice();
  const catalog = templatesOrDefault(data.outreachTemplates);
  const channels = (data.messagingChannels ?? []).filter((item) => item.status === "active");
  const [step, setStep] = useState<Step>("setup");
  const [selectedTypes, setSelectedTypes] = useState<MessagingChannelType[]>([]);
  const [templateId, setTemplateId] = useState(catalog[0]?.id ?? "");
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [waTemplate, setWaTemplate] = useState("");
  const [skipAlready, setSkipAlready] = useState(true);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [pending, start] = useTransition();
  const setup = data.mailSetup;
  const project = projectId || defaultPreplannerProjectId(data.projects);

  const readyTypes = useMemo(() => {
    return (["email_resend", "email_gmail", "sms_twilio", "whatsapp_twilio"] as MessagingChannelType[]).filter((type) => {
      if (type === "email_gmail") return Boolean(setup.gmail && (channels.some((item) => item.type === type) || data.gmailAccounts.length));
      if (type === "email_resend") return Boolean(setup.resend && (channels.some((item) => item.type === type) || data.domainSenders.length));
      if (type === "sms_twilio") return Boolean(setup.sms);
      return Boolean(setup.whatsapp);
    });
  }, [channels, data.domainSenders.length, data.gmailAccounts.length, setup]);

  const people = useMemo(() => {
    return households.flatMap((house) =>
      (house.people ?? []).map((person) => ({
        ...person,
        householdId: house.id,
        householdName: house.name,
      })),
    );
  }, [households]);

  const families = selectedTypes.map((type) => channelFamily(type)).filter((item, index, list) => list.indexOf(item) === index) as MessageFamily[];

  const plan = useMemo(
    () => planCampaignAudience({
      people,
      families: families.length ? families : ["email"],
      skipAlready,
      projectId: project,
      facts: data.contactedFacts ?? [],
    }),
    [people, families, skipAlready, project, data.contactedFacts],
  );

  useEffect(() => {
    if (!open) return;
    const first = readyTypes[0];
    setSelectedTypes(first ? [first] : []);
    const tmpl = catalog[0];
    setTemplateId(tmpl?.id ?? "");
    setSubjects({ email: tmpl?.subject ?? "" });
    setBodies({
      email: tmpl?.email ?? "",
      sms: tmpl?.sms ?? "",
      whatsapp: tmpl?.sms ?? "",
    });
    setSkipAlready(true);
    setIndex(0);
    setResults([]);
    setError("");
    setStep("setup");
    setWaTemplate("");
  }, [open]);

  const current = plan.ready[index];

  function toggleType(type: MessagingChannelType) {
    setSelectedTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  }

  function previewText(family: MessageFamily, personName: string, house: HouseholdView | undefined, raw: string, subject?: string) {
    const [first, ...rest] = (personName || house?.name || "").split(" ");
    return fillPlaceholders(raw, {
      firstName: first ?? "",
      lastName: rest.join(" "),
      fullName: personName || house?.name || "",
      state: house?.state ?? "",
      city: house?.city ?? "",
      address: house?.street ?? "",
      email: "",
      phone: "",
      zip: house?.zip ?? "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">
            {step === "done" ? "Send results" : step === "sending" ? "Sending…" : step === "confirm" ? "Confirm send" : step === "preview" ? "Preview each message" : "Message this state"}
          </DialogTitle>
        </DialogHeader>
        {state && state !== "ALL" ? <p className="text-sm text-muted-foreground">Audience: {households.length} contacts in {state}{project ? ", this project" : ""}.</p> : <p className="text-sm text-muted-foreground">Audience: {households.length} contacts.</p>}
        {error ? <Notice>{error}</Notice> : null}

        {step === "setup" ? (
          <div className="grid gap-3">
            <fieldset>
              <legend className="text-sm text-muted-foreground">Channels</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["email_resend", "email_gmail", "sms_twilio", "whatsapp_twilio"] as MessagingChannelType[]).map((type) => {
                  const ready = readyTypes.includes(type);
                  const checked = selectedTypes.includes(type);
                  return (
                    <label key={type} className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm ring-1 ${checked ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-input"} ${!ready ? "opacity-60" : ""}`}>
                      <input type="checkbox" className="sr-only" disabled={!ready} checked={checked} onChange={() => toggleType(type)} />
                      {channelTypeLabel(type)}{!ready ? " · Setup needed" : ""}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {!readyTypes.length ? (
              <Notice>Setup needed: an admin has to add the Google, Resend, or Twilio credentials, then connect a channel in Settings.</Notice>
            ) : null}
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Template</span>
              <select className="h-11 rounded-xl border bg-card px-3 text-sm" value={templateId} onChange={(event) => {
                const id = event.target.value;
                setTemplateId(id);
                const tmpl = catalog.find((item) => item.id === id);
                if (tmpl) {
                  setSubjects({ email: tmpl.subject });
                  setBodies({ email: tmpl.email, sms: tmpl.sms, whatsapp: tmpl.sms });
                }
              }}>
                {catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            {selectedTypes.some((type) => channelFamily(type) === "email") ? (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Email subject</span>
                  <Input value={subjects.email ?? ""} onChange={(event) => setSubjects((current) => ({ ...current, email: event.target.value }))} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Email message</span>
                  <Textarea className="min-h-28" value={bodies.email ?? ""} onChange={(event) => setBodies((current) => ({ ...current, email: event.target.value }))} />
                </label>
              </>
            ) : null}
            {selectedTypes.some((type) => channelFamily(type) === "sms") ? (
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Text message</span>
                <Textarea className="min-h-24" value={bodies.sms ?? ""} onChange={(event) => setBodies((current) => ({ ...current, sms: event.target.value }))} />
              </label>
            ) : null}
            {selectedTypes.some((type) => channelFamily(type) === "whatsapp") ? (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">WhatsApp message (inside the 24-hour window)</span>
                  <Textarea className="min-h-24" value={bodies.whatsapp ?? ""} onChange={(event) => setBodies((current) => ({ ...current, whatsapp: event.target.value }))} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">WhatsApp template name or Content SID (required outside the 24-hour window)</span>
                  <Input value={waTemplate} onChange={(event) => setWaTemplate(event.target.value)} placeholder="HXxxx or template name" />
                </label>
              </>
            ) : null}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={skipAlready} onChange={(event) => setSkipAlready(event.target.checked)} />
              <span>Skip people already contacted (this project). On by default.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11 rounded-full" disabled={!selectedTypes.length || !plan.ready.length} onClick={() => { setIndex(0); setStep("preview"); }}>
                Preview ({plan.ready.length})
              </Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        ) : null}

        {step === "preview" && current ? (
          <div className="grid gap-3">
            <p className="text-sm text-foreground">{current.person.householdName} · {current.person.name} · {channelTypeLabel(selectedTypes.find((type) => channelFamily(type) === current.family) ?? current.family)}</p>
            {current.family === "email" ? <Input value={previewText("email", current.person.name, households.find((h) => h.id === current.person.householdId), subjects.email ?? "")} readOnly /> : null}
            <Textarea className="min-h-32" readOnly value={previewText(current.family, current.person.name, households.find((h) => h.id === current.person.householdId), bodies[current.family] ?? "")} />
            <p className="text-xs text-muted-foreground">{index + 1} of {plan.ready.length}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={index === 0} onClick={() => setIndex((n) => Math.max(0, n - 1))}>Back</Button>
              {index < plan.ready.length - 1 ? (
                <Button type="button" className="min-h-11 rounded-full" onClick={() => setIndex((n) => n + 1)}>Next</Button>
              ) : (
                <Button type="button" className="min-h-11 rounded-full" onClick={() => setStep("confirm")}>Continue</Button>
              )}
            </div>
          </div>
        ) : null}

        {step === "confirm" || step === "sending" || step === "done" ? (
          <div className="grid gap-3">
            <p className="text-sm text-foreground">Send {plan.ready.length} individual message{plan.ready.length === 1 ? "" : "s"} on {families.join(", ")}.</p>
            {plan.skipped.length ? (
              <div className="rounded-2xl bg-muted/50 p-3 text-sm">
                <p className="font-medium text-foreground">{plan.skipped.length} skipped</p>
                <ul className="mt-1 max-h-40 overflow-y-auto text-muted-foreground">
                  {plan.skipped.slice(0, 40).map((item, i) => (
                    <li key={`${item.householdId}-${item.reason}-${i}`}>{item.name}: {item.detail}</li>
                  ))}
                  {plan.skipped.length > 40 ? <li>…and {plan.skipped.length - 40} more</li> : null}
                </ul>
              </div>
            ) : null}
            {results.length ? (
              <ul className="max-h-40 overflow-y-auto text-sm">
                {results.map((item, i) => (
                  <li key={`${item.name}-${i}`} className={item.ok ? "text-foreground" : "text-red-600"}>{item.name}: {item.ok ? "Sent" : item.error}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {step === "confirm" ? (
                <Button
                  type="button"
                  className="min-h-11 rounded-full"
                  disabled={pending || !plan.ready.length}
                  onClick={() => start(async () => {
                    setStep("sending");
                    const next: { name: string; ok: boolean; error?: string }[] = [];
                    if (practice.active) {
                      announce({ ok: true }, "Practice mode — nothing was sent");
                      setResults(plan.ready.map((item) => ({ name: item.person.householdName, ok: true })));
                      setStep("done");
                      return;
                    }
                    for (const item of plan.ready) {
                      const type = selectedTypes.find((candidate) => channelFamily(candidate) === item.family) ?? (item.family === "email" ? "email_resend" : item.family === "whatsapp" ? "whatsapp_twilio" : "sms_twilio");
                      const channel = channels.find((row) => row.type === type && defaultStatesOverlap(row.defaultStates, state));
                      const house = households.find((h) => h.id === item.person.householdId);
                      const body = previewText(item.family, item.person.name, house, bodies[item.family] ?? "");
                      const subject = item.family === "email" ? previewText("email", item.person.name, house, subjects.email ?? "") : undefined;
                      const thread = (data.messageThreads ?? []).find((t) => t.householdId === item.person.householdId && channelFamily(t.channelType) === "whatsapp");
                      const needsTemplate = item.family === "whatsapp" && !withinWhatsAppWindow(thread?.lastInboundAt);
                      const result = await sendCampaignMessageAction({
                        channelId: channel?.id,
                        type,
                        to: item.address,
                        body,
                        subject,
                        householdId: item.person.householdId,
                        personId: item.person.id,
                        projectId: project,
                        templateName: needsTemplate ? waTemplate || undefined : undefined,
                      });
                      next.push({ name: `${item.person.householdName} (${item.family})`, ok: result.ok, error: result.ok ? undefined : result.error });
                      setResults([...next]);
                    }
                    setStep("done");
                  })}
                >
                  Send
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={onClose}>{step === "done" ? "Close" : "Cancel"}</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
