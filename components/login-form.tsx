"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, AuthErrorText } from "@/components/auth-card";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { googleSignInAction, sendMagicLinkAction, signInAction } from "@/lib/actions";

const ERRORS: Record<string, string> = {
  "no-invite": "That account is not on the team. Ask an admin to invite your email.",
  "missing-code": "That sign-in link is missing its code. Request a new one.",
};

export function LoginForm({ google, errorCode }: { google: boolean; errorCode: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [error, setError] = useState(AuthErrorText(errorCode, ERRORS));
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setInfo("");
    const result = await signInAction(email, password);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.push("/households");
    router.refresh();
  }

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setInfo("");
    const result = await sendMagicLinkAction(linkEmail || email);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInfo(result.warning ?? "Check your email for a sign-in link.");
  }

  return (
    <AuthCard title="Sign in to Cora Connect" subtitle="Chabad Outreach to Rural America">
      <form className="space-y-3" onSubmit={(event) => void signIn(event)}>
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Email</span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Password</span>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
        </label>
        {error ? <Notice>{error}</Notice> : null}
        {info ? <Notice tone="ok">{info}</Notice> : null}
        <Button type="submit" disabled={pending} className="h-10 w-full rounded-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-3 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-link">Forgot password?</Link>
        <Link href="/signup" className="text-link">Create an account</Link>
      </div>
      <details className="mt-5 rounded-2xl bg-muted/70 px-3 py-2">
        <summary className="cursor-pointer text-sm text-foreground">Email me a sign-in link instead</summary>
        <form className="mt-3 space-y-3" onSubmit={(event) => void sendLink(event)}>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Email</span>
            <Input
              type="email"
              value={linkEmail}
              onChange={(event) => setLinkEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder={email || "you@example.com"}
            />
          </label>
          <Button type="submit" variant="outline" disabled={pending} className="h-10 w-full rounded-full">
            Email me a sign-in link
          </Button>
        </form>
      </details>
      {google ? (
        <form action={googleSignInAction} className="mt-3">
          <Button type="submit" variant="outline" className="h-10 w-full rounded-full">
            Continue with Google
          </Button>
        </form>
      ) : null}
      <p className="mt-4 text-xs text-mutedink">
        Creating an account does not open the database. An admin approves you after you sign up.
      </p>
    </AuthCard>
  );
}
