import "server-only";

export type WhatsAppTemplateStatus = "approved" | "pending" | "rejected" | "missing";

export type WhatsAppTemplateState = {
  status: WhatsAppTemplateStatus;
  body?: string;
  name?: string;
};

const CACHE_MS = 60_000;
let cache: { at: number; value: WhatsAppTemplateState } | null = null;

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

export async function whatsappTemplateState(force = false): Promise<WhatsAppTemplateState> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const contentSid = twilioWhatsappContentSid();
  if (!contentSid) {
    const value: WhatsAppTemplateState = { status: "missing" };
    cache = { at: Date.now(), value };
    return value;
  }
  const account = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!account || !token) {
    const value: WhatsAppTemplateState = { status: "pending" };
    cache = { at: Date.now(), value };
    return value;
  }
  const auth = "Basic " + Buffer.from(`${account}:${token}`).toString("base64");
  try {
    const [approvalRes, contentRes] = await Promise.all([
      fetch(`https://content.twilio.com/v1/Content/${encodeURIComponent(contentSid)}/ApprovalRequests`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
      fetch(`https://content.twilio.com/v1/Content/${encodeURIComponent(contentSid)}`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
    ]);
    const approval = approvalRes.ok ? ((await approvalRes.json()) as { whatsapp?: { status?: string; name?: string } }) : {};
    const content = contentRes.ok
      ? ((await contentRes.json()) as { friendly_name?: string; types?: { "twilio/text"?: { body?: string } } })
      : {};
    const value: WhatsAppTemplateState = {
      status: mapStatus(approval.whatsapp?.status),
      name: approval.whatsapp?.name || content.friendly_name,
      body: content.types?.["twilio/text"]?.body,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    const value: WhatsAppTemplateState = { status: "pending" };
    cache = { at: Date.now(), value };
    return value;
  }
}
