import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType, SupabaseClient, User } from "@supabase/supabase-js";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function isOtpType(value: string): value is EmailOtpType {
  return OTP_TYPES.has(value as EmailOtpType);
}

async function finish(requestUrl: URL, supabase: SupabaseClient, user: User | null, errorMessage?: string, kind?: string) {
  if (errorMessage || !user) {
    const message = errorMessage || "The sign-in link could not be used.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, requestUrl.origin));
  }
  const profile = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile.data) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=no-invite", requestUrl.origin));
  }
  if (kind === "recovery") {
    const cookieStore = await cookies();
    cookieStore.set(PASSWORD_RECOVERY_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
      secure: requestUrl.protocol === "https:",
    });
    return NextResponse.redirect(new URL("/settings?tab=account", requestUrl.origin));
  }
  return NextResponse.redirect(new URL("/households", requestUrl.origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const description = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (description && !url.searchParams.get("code") && !url.searchParams.get("token_hash")) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(description)}`, url.origin));
  }

  const supabase = await createClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && type && isOtpType(type)) {
    const verified = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return finish(url, supabase, verified.data.user ?? null, verified.error?.message, type);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing-code", url.origin));
  }
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  return finish(url, supabase, exchanged.data.user ?? null, exchanged.error?.message);
}
