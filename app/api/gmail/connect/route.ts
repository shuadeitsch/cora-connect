import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { assertNotPreview } from "@/lib/preview";
import { canMessageRole, MESSAGING_BLOCKED_MESSAGE } from "@/lib/messaging-access";
import { getCurrentUser } from "@/lib/session";
import { requestOrigin } from "@/lib/site";
import { mailSetupStatus } from "@/lib/mail-status";
import { gmailAuthUrl, gmailRedirectUri } from "@/lib/mail-send";
import { randomBytes } from "crypto";

export async function GET() {
  const origin = await requestOrigin();
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host"))?.split(",")[0]?.trim();
  const canonicalHost = new URL(origin).host;
  // Set the OAuth cookie on the same host Google will return to (redirect_uri).
  if (host && host !== canonicalHost) {
    return NextResponse.redirect(new URL("/api/gmail/connect", origin));
  }
  const gate = await assertNotPreview();
  if (!gate.ok) return NextResponse.redirect(new URL("/settings?tab=messaging&mail=preview", origin));
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!canMessageRole(user.role)) return NextResponse.json({ ok: false, error: MESSAGING_BLOCKED_MESSAGE }, { status: 403 });
  if (!mailSetupStatus().gmail) return NextResponse.redirect(new URL("/settings?tab=messaging&mail=setup", origin));
  const state = randomBytes(24).toString("base64url");
  const url = gmailAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirectUri: gmailRedirectUri(origin),
    state,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set("cora_gmail_oauth", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/api/gmail",
    maxAge: 600,
  });
  return res;
}
