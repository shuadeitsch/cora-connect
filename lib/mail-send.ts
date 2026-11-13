import "server-only";
import { decryptSecret } from "@/lib/mail-crypto";
import { requestOrigin } from "@/lib/site";
import { signUnsubscribeToken } from "@/lib/mail-crypto";

const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const RESEND_URL = "https://api.resend.com/emails";

export function gmailRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/gmail/callback`;
}

export function gmailAuthUrl(input: { clientId: string; redirectUri: string; state: string; loginHint?: string }) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: input.state,
  });
  if (input.loginHint) params.set("login_hint", input.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Gmail is not set up yet.");
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; access_token?: string; error?: string; error_description?: string };
  if (!res.ok) throw new Error(json.error_description || json.error || "Google did not return a token.");
  if (!json.refresh_token) throw new Error("Google did not return a refresh token. Disconnect the app in the Google account and connect again.");
  return { refreshToken: json.refresh_token, accessToken: json.access_token ?? "" };
}

export async function gmailAddressFromAccessToken(accessToken: string): Promise<string | null> {
  const res = await fetch(GMAIL_PROFILE_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const json = (await res.json()) as { emailAddress?: string };
  return json.emailAddress?.trim().toLowerCase() || null;
}

export async function gmailAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Gmail is not set up yet.");
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(json.error_description || json.error || "Could not refresh the Gmail token.");
  return json.access_token;
}

function rfc2822(input: { from: string; to: string; subject: string; body: string }) {
  const subject = /^[\x20-\x7e]+$/.test(input.subject)
    ? input.subject
    : `=?UTF-8?B?${Buffer.from(input.subject, "utf8").toString("base64")}?=`;
  return [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body.replace(/\r?\n/g, "\r\n"),
  ].join("\r\n");
}

export async function sendViaGmail(input: {
  cipher: string;
  iv: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  const refresh = decryptSecret(input.cipher, input.iv);
  const access = await gmailAccessToken(refresh);
  const raw = Buffer.from(rfc2822({ from: input.from, to: input.to, subject: input.subject, body: input.body }), "utf8").toString("base64url");
  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Gmail could not send that message.");
  return json.id ?? "sent";
}

export function withUnsubscribeFooter(body: string, url: string) {
  const trimmed = body.trimEnd();
  if (trimmed.includes(url)) return trimmed;
  return `${trimmed}\n\n—\nIf you no longer wish to receive these emails, unsubscribe here:\n${url}`;
}

export async function unsubscribeUrlFor(personId: string, email: string) {
  const origin = await requestOrigin();
  const token = signUnsubscribeToken({ personId, email });
  return `${origin}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function sendViaResend(input: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("Domain sending is not set up yet.");
  const from = input.fromName.trim() ? `${input.fromName.trim()} <${input.fromEmail}>` : input.fromEmail;
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
    }),
  });
  const json = (await res.json()) as { id?: string; message?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || json.message || "Resend could not send that message.");
  return json.id ?? "sent";
}
