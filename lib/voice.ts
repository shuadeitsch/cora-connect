import "server-only";
import { createHmac } from "crypto";
import { requestOrigin } from "@/lib/site";
import { createEphemeralClient } from "@/lib/supabase/server";
import { messagingIngestKey } from "@/lib/messaging-status";
import { verifyTwilioSignature } from "@/lib/messaging-send";
import { CALLER_ID } from "@/lib/voice-shared";

export { CALLER_ID };

export function voiceConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_API_KEY_SID?.trim() && process.env.TWILIO_API_KEY_SECRET?.trim() && process.env.TWILIO_TWIML_APP_SID?.trim(),
  );
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** Short-lived Twilio Access Token (JWT, HS256) with a Voice grant. Identity is the CRM user id. */
export function mintVoiceToken(identity: string, ttlSeconds = 3600): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const keySid = process.env.TWILIO_API_KEY_SID!.trim();
  const secret = process.env.TWILIO_API_KEY_SECRET!.trim();
  const appSid = process.env.TWILIO_TWIML_APP_SID!.trim();
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${keySid}-${now}`,
    iss: keySid,
    sub: accountSid,
    iat: now,
    nbf: now,
    exp: now + ttlSeconds,
    grants: { identity, voice: { incoming: { allow: true }, outgoing: { application_sid: appSid } } },
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createHmac("sha256", secret).update(unsigned).digest();
  return `${unsigned}.${b64url(sig)}`;
}

export function xml(body: string, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
export function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function siteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (await requestOrigin());
}

/** Parse the form body and check X-Twilio-Signature against the public site URL. Returns null when the request is not from Twilio. */
export async function verifiedParams(req: Request, path: string): Promise<Record<string, string> | null> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") params[key] = value;
  const origin = await siteOrigin();
  const url = new URL(path, `${origin}/`);
  url.search = new URL(req.url).search;
  const ok = verifyTwilioSignature({ url: url.toString(), params, signature: req.headers.get("x-twilio-signature") });
  return ok ? params : null;
}

export async function voiceRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const key = messagingIngestKey();
  if (!key) return null;
  const supabase = createEphemeralClient();
  const { data, error } = await supabase.rpc(fn as never, { p_key: key, ...args } as never);
  if (error) {
    console.error("voice rpc", fn, error.message);
    return null;
  }
  return data as T;
}

export function upsertCall(p: Record<string, unknown>) {
  return voiceRpc("voice_upsert_call", { p });
}
