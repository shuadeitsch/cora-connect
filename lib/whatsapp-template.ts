import "server-only";
import type { WhatsAppContentTemplate, WhatsAppTemplateStatus } from "@/lib/types";

export type WhatsAppTemplateState = {
  status: WhatsAppTemplateStatus;
  body?: string;
  name?: string;
  sid?: string;
  templates: WhatsAppContentTemplate[];
};

const CACHE_MS = 60_000;
let cache: { at: number; value: WhatsAppTemplateState } | null = null;

const LABELS: Record<string, string> = {
  cora_maine_chanukah: "Chanukah visit",
  cora_maine_visit: "Visit",
};

type TwilioContentTypes = Record<string, { body?: string } | undefined>;

type TwilioContentAndApproval = {
  sid?: string;
  friendly_name?: string;
  date_created?: string;
  types?: TwilioContentTypes;
  approval_requests?: {
    status?: string;
    name?: string;
    category?: string;
    whatsapp?: { status?: string; name?: string; category?: string };
  };
};

export function twilioWhatsappContentSid(): string | null {
  const sid = process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim();
  return sid || null;
}

function mapStatus(raw: string | undefined): WhatsAppTemplateStatus {
  const status = (raw ?? "").trim().toLowerCase();
  if (status === "approved") return "approved";
  if (status === "rejected" || status === "paused" || status === "disabled") return "rejected";
  if (!status) return "pending";
  return "pending";
}

function isCoraName(name: string | undefined): boolean {
  return (name ?? "").trim().toLowerCase().startsWith("cora_");
}

function contentBody(types?: TwilioContentTypes): string {
  return types?.["twilio/text"]?.body || types?.["whatsapp/text"]?.body || Object.values(types ?? {}).find((item) => item?.body)?.body || "";
}

function prettyLabel(name: string): string {
  if (LABELS[name]) return LABELS[name];
  const trimmed = name.replace(/^cora_maine_/i, "").replace(/^cora_/i, "").replace(/_/g, " ").trim();
  if (!trimmed) return name;
  return trimmed.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function approvalOf(item: TwilioContentAndApproval): { status?: string; name?: string } | null {
  const requests = item.approval_requests;
  if (!requests) return null;
  return requests.whatsapp ?? requests;
}

function toTemplate(item: TwilioContentAndApproval): WhatsAppContentTemplate | null {
  const sid = (item.sid ?? "").trim();
  if (!sid) return null;
  const approval = approvalOf(item);
  const name = (approval?.name || item.friendly_name || "").trim();
  if (!isCoraName(name) && !isCoraName(item.friendly_name)) return null;
  if (!approval?.status && !approval?.name) return null;
  const status = mapStatus(approval?.status);
  if (status === "missing") return null;
  return {
    sid,
    name: name || sid,
    label: prettyLabel(name || item.friendly_name || sid),
    body: contentBody(item.types),
    status,
  };
}

function overallStatus(templates: WhatsAppContentTemplate[]): WhatsAppTemplateStatus {
  if (templates.some((item) => item.status === "approved")) return "approved";
  if (templates.some((item) => item.status === "pending")) return "pending";
  if (templates.some((item) => item.status === "rejected")) return "rejected";
  return "missing";
}

function pickDefault(templates: WhatsAppContentTemplate[], envSid: string | null): WhatsAppContentTemplate | undefined {
  const env = envSid ? templates.find((item) => item.sid === envSid) : undefined;
  if (env?.status === "approved") return env;
  const approved = templates.find((item) => item.status === "approved");
  if (approved) return approved;
  if (env) return env;
  return templates[0];
}

function sortTemplates(items: { template: WhatsAppContentTemplate; created?: string }[]): WhatsAppContentTemplate[] {
  const rank = { approved: 0, pending: 1, rejected: 2 };
  return [...items]
    .sort((a, b) => {
      const byStatus = rank[a.template.status] - rank[b.template.status];
      if (byStatus) return byStatus;
      return (b.created ?? "").localeCompare(a.created ?? "");
    })
    .map((item) => item.template);
}

async function fetchEnvFallback(auth: string, sid: string): Promise<TwilioContentAndApproval | null> {
  const [approvalRes, contentRes] = await Promise.all([
    fetch(`https://content.twilio.com/v1/Content/${encodeURIComponent(sid)}/ApprovalRequests`, {
      headers: { Authorization: auth },
      cache: "no-store",
    }),
    fetch(`https://content.twilio.com/v1/Content/${encodeURIComponent(sid)}`, {
      headers: { Authorization: auth },
      cache: "no-store",
    }),
  ]);
  const content = contentRes.ok ? ((await contentRes.json()) as TwilioContentAndApproval) : null;
  const approval = approvalRes.ok ? ((await approvalRes.json()) as { whatsapp?: { status?: string; name?: string } }) : {};
  if (!content?.sid && !approval.whatsapp) return null;
  return {
    sid: content?.sid || sid,
    friendly_name: content?.friendly_name,
    date_created: content?.date_created,
    types: content?.types,
    approval_requests: { whatsapp: approval.whatsapp },
  };
}

async function fetchContentAndApprovals(auth: string): Promise<TwilioContentAndApproval[]> {
  const items: TwilioContentAndApproval[] = [];
  let url: string | null = "https://content.twilio.com/v1/ContentAndApprovals?PageSize=50";
  while (url) {
    const res = await fetch(url, { headers: { Authorization: auth }, cache: "no-store" });
    if (!res.ok) throw new Error("Twilio ContentAndApprovals failed");
    const data = (await res.json()) as { contents?: TwilioContentAndApproval[]; meta?: { next_page_url?: string | null } };
    items.push(...(data.contents ?? []));
    url = data.meta?.next_page_url ?? null;
  }
  return items;
}

function stateFromTemplates(templates: WhatsAppContentTemplate[], envSid: string | null): WhatsAppTemplateState {
  const chosen = pickDefault(templates, envSid);
  return {
    status: overallStatus(templates),
    templates,
    sid: chosen?.sid,
    name: chosen?.name,
    body: chosen?.body,
  };
}

export async function whatsappTemplateState(force = false): Promise<WhatsAppTemplateState> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const envSid = twilioWhatsappContentSid();
  const account = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!account || !token) {
    const value: WhatsAppTemplateState = { status: envSid ? "pending" : "missing", sid: envSid ?? undefined, templates: [] };
    cache = { at: Date.now(), value };
    return value;
  }
  const auth = "Basic " + Buffer.from(`${account}:${token}`).toString("base64");
  try {
    let rows = await fetchContentAndApprovals(auth);
    if (!rows.length && envSid) {
      const fallback = await fetchEnvFallback(auth, envSid);
      if (fallback) rows = [fallback];
    } else if (envSid && !rows.some((item) => item.sid === envSid)) {
      const fallback = await fetchEnvFallback(auth, envSid);
      if (fallback) rows = [...rows, fallback];
    }
    const prepared: { template: WhatsAppContentTemplate; created?: string }[] = [];
    for (const item of rows) {
      const template = toTemplate(item);
      if (template) prepared.push({ template, created: item.date_created });
    }
    const templates = sortTemplates(prepared);
    const value = templates.length
      ? stateFromTemplates(templates, envSid)
      : { status: (envSid ? "pending" : "missing") as WhatsAppTemplateStatus, sid: envSid ?? undefined, templates: [] };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    const value: WhatsAppTemplateState = { status: envSid ? "pending" : "missing", sid: envSid ?? undefined, templates: [] };
    cache = { at: Date.now(), value };
    return value;
  }
}

export function findWhatsAppTemplate(state: WhatsAppTemplateState, contentSid?: string | null): WhatsAppContentTemplate | undefined {
  const sid = (contentSid ?? "").trim() || state.sid || twilioWhatsappContentSid() || "";
  if (!sid) return state.templates.find((item) => item.status === "approved") ?? state.templates[0];
  return state.templates.find((item) => item.sid === sid);
}
