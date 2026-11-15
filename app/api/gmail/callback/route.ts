import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { requestOrigin } from "@/lib/site";
import { exchangeGmailCode, gmailAddressFromAccessToken, gmailRedirectUri } from "@/lib/mail-send";
import { encryptSecret } from "@/lib/mail-crypto";
import { saveGmailAccountToken } from "@/lib/supabase/write";

function fail(settings: URL, reason: string, log?: string) {
  if (log) console.error("Gmail connect:", log);
  settings.searchParams.set("mail", reason);
  return settings;
}

export async function GET(request: Request) {
  const origin = await requestOrigin();
  const settings = new URL("/settings?tab=account", origin);
  const clearCookie = (res: NextResponse) => {
    res.cookies.set("cora_gmail_oauth", "", { httpOnly: true, path: "/api/gmail", maxAge: 0 });
    return res;
  };
  const gate = await assertNotPreview();
  if (!gate.ok) {
    return clearCookie(NextResponse.redirect(fail(settings, "preview")));
  }
  const user = await getCurrentUser();
  if (!user) {
    console.error("Gmail connect: signed-out callback; account was not saved.");
    return clearCookie(NextResponse.redirect(new URL("/login", origin)));
  }
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return clearCookie(NextResponse.redirect(fail(settings, "denied", `Google returned ${error}`)));
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const expected = (await cookies()).get("cora_gmail_oauth")?.value ?? "";
  if (!code || !state || !expected || state !== expected) {
    const detail = !code ? "missing code" : "state mismatch or missing cookie";
    return clearCookie(NextResponse.redirect(fail(settings, "invalid", detail)));
  }
  try {
    const tokens = await exchangeGmailCode(code, gmailRedirectUri(origin));
    let email = await gmailAddressFromAccessToken(tokens.accessToken);
    if (!email) email = user.email.trim().toLowerCase();
    const stored = encryptSecret(tokens.refreshToken);
    await saveGmailAccountToken(email, stored.cipher, stored.iv);
    settings.searchParams.set("mail", "connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Gmail connect failed:", message);
    settings.searchParams.set("mail", "error");
  }
  return clearCookie(NextResponse.redirect(settings));
}
