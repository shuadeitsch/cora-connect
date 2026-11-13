import { NextResponse } from "next/server";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { requestOrigin } from "@/lib/site";
import { mailSetupStatus } from "@/lib/mail-status";
import { gmailAuthUrl, gmailRedirectUri } from "@/lib/mail-send";
import { randomBytes } from "crypto";

export async function GET() {
  const gate = await assertNotPreview();
  if (!gate.ok) return NextResponse.redirect(new URL("/settings?tab=account&mail=preview", await requestOrigin().then((o) => o)));
  const user = await getCurrentUser();
  const origin = await requestOrigin();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!mailSetupStatus().gmail) return NextResponse.redirect(new URL("/settings?tab=account&mail=setup", origin));
  const state = randomBytes(24).toString("base64url");
  const url = gmailAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirectUri: gmailRedirectUri(origin),
    state,
    loginHint: user.email,
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
