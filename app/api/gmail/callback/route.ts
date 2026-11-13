import { NextResponse } from "next/server";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { requestOrigin } from "@/lib/site";
import { exchangeGmailCode, gmailAddressFromAccessToken, gmailRedirectUri } from "@/lib/mail-send";
import { encryptSecret } from "@/lib/mail-crypto";
import { saveGmailAccountToken } from "@/lib/supabase/write";

export async function GET(request: Request) {
  const origin = await requestOrigin();
  const settings = new URL("/settings?tab=account", origin);
  const gate = await assertNotPreview();
  if (!gate.ok) {
    settings.searchParams.set("mail", "preview");
    return NextResponse.redirect(settings);
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    settings.searchParams.set("mail", "denied");
    return NextResponse.redirect(settings);
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const cookie = request.headers.get("cookie") ?? "";
  const expected = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("cora_gmail_oauth="))?.slice("cora_gmail_oauth=".length) ?? "";
  if (!code || !state || !expected || state !== expected) {
    settings.searchParams.set("mail", "invalid");
    return NextResponse.redirect(settings);
  }
  try {
    const tokens = await exchangeGmailCode(code, gmailRedirectUri(origin));
    let email = await gmailAddressFromAccessToken(tokens.accessToken);
    if (!email) email = user.email.trim().toLowerCase();
    const stored = encryptSecret(tokens.refreshToken);
    await saveGmailAccountToken(email, stored.cipher, stored.iv);
    settings.searchParams.set("mail", "connected");
  } catch {
    settings.searchParams.set("mail", "error");
  }
  const res = NextResponse.redirect(settings);
  res.cookies.set("cora_gmail_oauth", "", { httpOnly: true, path: "/api/gmail", maxAge: 0 });
  return res;
}
