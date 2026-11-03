"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthCard, AuthErrorText } from "@/components/auth-card";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendPasswordResetAction } from "@/lib/actions";

const ERRORS: Record<string, string> = {
  "missing-code": "That reset link is missing its code. Request a new one.",
};

export function ForgotPasswordForm({ errorCode }: { errorCode: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(AuthErrorText(errorCode, ERRORS));
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setInfo("");
    const result = await sendPasswordResetAction(email);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInfo(result.warning ?? "Check your email for a reset link.");
  }

  return (
    <AuthCard title="Reset your password" subtitle="We will email a link if this address already has an account.">
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Email</span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </label>
        {error ? <Notice>{error}</Notice> : null}
        {info ? <Notice tone="ok">{info}</Notice> : null}
        <Button type="submit" disabled={pending} className="h-10 w-full rounded-full">
          {pending ? "Sending…" : "Email me a reset link"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-mutedink">
        <Link href="/login" className="text-link">Back to sign in</Link>
        <span className="px-2 text-muted-foreground">·</span>
        <Link href="/signup" className="text-link">Create an account</Link>
      </p>
    </AuthCard>
  );
}
