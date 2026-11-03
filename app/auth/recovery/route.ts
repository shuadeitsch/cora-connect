import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/forgot-password?error=${encodeURIComponent(message)}`, url.origin));

  const description = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (description && !url.searchParams.get("code") && !url.searchParams.get("token_hash")) {
    return fail(description);
  }

  const supabase = await createClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let userId: string | null = null;
  let message: string | undefined;

  if (tokenHash && type && OTP_TYPES.has(type as EmailOtpType)) {
    const verified = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    userId = verified.data.user?.id ?? null;
    message = verified.error?.message;
  } else {
    const code = url.searchParams.get("code");
    if (!code) return fail("missing-code");
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    userId = exchanged.data.user?.id ?? null;
    message = exchanged.error?.message;
  }

  if (message || !userId) return fail(message || "The reset link could not be used.");

  const profile = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile.data) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=no-invite", url.origin));
  }

  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
    secure: url.protocol === "https:",
  });
  return NextResponse.redirect(new URL("/settings?tab=account", url.origin));
}
