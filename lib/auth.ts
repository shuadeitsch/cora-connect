import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { googleAuthEnabled, requestOrigin } from "@/lib/site";
import type { ActionResult } from "@/lib/types";

export const PASSWORD_RECOVERY_COOKIE = "cora_password_recovery";
const MIN_PASSWORD = 8;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function passwordProblem(password: string, confirm?: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (confirm != null && password !== confirm) return "Those passwords do not match.";
  return null;
}

async function ensureAllowed(email: string): Promise<ActionResult> {
  const supabase = await createClient();
  const allowed = await supabase.rpc("login_allowed", { target_email: email });
  if (allowed.error) {
    return { ok: false, error: "Sign-in is not ready yet. Apply supabase/migrations/001_init.sql first." };
  }
  if (!allowed.data) {
    return { ok: false, error: "That email is not on the team. An admin has to invite you first." };
  }
  return { ok: true };
}

function isNextRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

export async function redirectIfSignedIn() {
  try {
    const user = await getCurrentUser();
    if (user) redirect("/households");
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return;
  }
  try {
    const supabase = await createClient();
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data.user) return;
    await supabase.auth.signOut();
  } catch (error) {
    if (isNextRedirect(error)) throw error;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<ActionResult> {
  const normalized = normalizeEmail(email);
  if (!/.+@.+\..+/.test(normalized)) return { ok: false, error: "Enter a valid email." };
  if (!password) return { ok: false, error: "Enter your password." };
  const gate = await ensureAllowed(normalized);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return { ok: false, error: "Confirm your email first. The confirmation message is in your inbox." };
    }
    return { ok: false, error: "Email or password is wrong." };
  }
  return { ok: true };
}

export async function signUpWithPassword(name: string, email: string, password: string, confirm: string): Promise<ActionResult> {
  const trimmed = name.trim();
  const normalized = normalizeEmail(email);
  if (trimmed.length < 2) return { ok: false, error: "Enter your name." };
  if (!/.+@.+\..+/.test(normalized)) return { ok: false, error: "Enter a valid email." };
  const problem = passwordProblem(password, confirm);
  if (problem) return { ok: false, error: problem };
  const gate = await ensureAllowed(normalized);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { full_name: trimmed, name: trimmed },
    },
  });
  if (error) {
    if (/already registered|already been registered/i.test(error.message)) {
      return { ok: false, error: "That email already has an account. Sign in instead." };
    }
    if (/database error saving new user/i.test(error.message)) {
      return { ok: false, error: "That email is not on the team. An admin has to invite you first." };
    }
    return { ok: false, error: error.message };
  }
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { ok: false, error: "That email already has an account. Sign in instead." };
  }
  if (!data.session) {
    return {
      ok: true,
      warning: "Check your email and confirm the address. After you sign in, an admin still has to approve the account.",
    };
  }
  return { ok: true };
}

export async function sendPasswordReset(email: string): Promise<ActionResult> {
  const normalized = normalizeEmail(email);
  if (!/.+@.+\..+/.test(normalized)) return { ok: false, error: "Enter a valid email." };
  const gate = await ensureAllowed(normalized);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: `${origin}/auth/recovery`,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    warning: "If that email already has a password, a reset link is on its way. Invited people who have not created an account yet should use Create account instead.",
  };
}

export async function sendMagicLink(email: string): Promise<ActionResult> {
  const normalized = normalizeEmail(email);
  if (!/.+@.+\..+/.test(normalized)) return { ok: false, error: "Enter a valid email." };
  const gate = await ensureAllowed(normalized);
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    if (/signups not allowed|user not found|not found/i.test(error.message)) {
      return { ok: false, error: "Create an account with a password first. The email link is only for an existing login." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, warning: "Check your email for a sign-in link. It expires shortly." };
}

export async function changePassword(current: string, next: string, confirm: string): Promise<ActionResult> {
  const problem = passwordProblem(next, confirm);
  if (problem) return { ok: false, error: problem };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return { ok: false, error: "Sign in again." };

  const cookieStore = await cookies();
  const recovery = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";
  if (!recovery) {
    if (!current) return { ok: false, error: "Enter your current password." };
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      return { ok: false, error: "That current password is wrong. If you have not set one yet, use Forgot password on the sign-in page." };
    }
  }

  const updated = await supabase.auth.updateUser({ password: next });
  if (updated.error) return { ok: false, error: updated.error.message };
  cookieStore.delete(PASSWORD_RECOVERY_COOKIE);
  return { ok: true, warning: "Password updated." };
}

export async function startGoogleSignIn(): Promise<ActionResult> {
  if (!googleAuthEnabled()) return { ok: false, error: "Google sign-in is turned off." };
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) return { ok: false, error: error?.message ?? "Google sign-in did not start." };
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
