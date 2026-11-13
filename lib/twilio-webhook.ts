import "server-only";
import { NextResponse } from "next/server";
import { applyOptOut, ingestInbound, matchContactByAddress, verifyTwilioSignature } from "@/lib/messaging-send";
import { channelFamily, smsOptOutCommand, type MessageFamily } from "@/lib/messaging";
import { messagingIngestKey } from "@/lib/messaging-status";
import { createEphemeralClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/site";

async function formParams(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

async function signedUrl(req: Request, path: string): Promise<string> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (await requestOrigin());
  const url = new URL(path, `${origin}/`);
  const incoming = new URL(req.url);
  url.search = incoming.search;
  return url.toString();
}

export async function handleTwilioWebhook(req: Request, kind: "sms" | "whatsapp") {
  const params = await formParams(req);
  const url = await signedUrl(req, kind === "sms" ? "/api/webhooks/twilio/sms" : "/api/webhooks/twilio/whatsapp");
  const signature = req.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature({ url, params, signature })) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const from = (params.From || "").replace(/^whatsapp:/, "");
  const to = (params.To || "").replace(/^whatsapp:/, "");
  const body = params.Body || params.MediaUrl0 || "";
  const sid = params.MessageSid || params.SmsMessageSid || "";
  if (!sid) return new NextResponse("Missing MessageSid", { status: 400 });

  const family: MessageFamily = kind === "whatsapp" ? "whatsapp" : "sms";
  const channelType = kind === "whatsapp" ? "whatsapp_twilio" : "sms_twilio";
  const key = messagingIngestKey();
  let orgId: string | undefined;
  let channelId: string | undefined;
  if (key) {
    const supabase = createEphemeralClient();
    const lookup = await supabase.rpc("lookup_messaging_channel", { p_key: key, p_address: to || from });
    const row = lookup.data?.[0] as { id?: string; org_id?: string } | undefined;
    if (row?.org_id) orgId = row.org_id;
    if (row?.id) channelId = row.id;
  }

  const match = await matchContactByAddress({ orgId, family, address: from });
  if (!match) {
    // Unknown sender: accept so Twilio does not retry, but do not create a contact.
    return new NextResponse("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  const command = smsOptOutCommand(body);
  if (command && match.personId) {
    await applyOptOut(match.personId, family, command === "stop");
  }

  const result = await ingestInbound({
    orgId: match.orgId,
    householdId: match.householdId,
    personId: match.personId,
    channelId,
    channelType,
    contactAddress: from,
    body: command === "stop" ? `${body}\n\n(Opted out)` : command === "start" ? `${body}\n\n(Opted back in)` : body,
    provider: "twilio",
    providerMessageId: sid,
  });
  if ("error" in result && result.error && !/No matching contact/i.test(result.error)) {
    return new NextResponse("Error", { status: 500 });
  }
  return new NextResponse("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } });
}

void channelFamily;
