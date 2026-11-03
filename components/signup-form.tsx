"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/lib/actions";

export function SignupForm({ initialEmail }: { initialEmail: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setInfo("");
    const result = await signUpAction(name, email, password, confirm);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    if (result.warning) {
      setPending(false);
      setInfo(result.warning);
      return;
    }
    router.push("/households");
    router.refresh();
  }

  return (
    <AuthCard title="Create a Cora Connect account" subtitle="Use the email on your invite or the signup allowlist. A Cora Connect admin approves you as a Cora Connect admin or a shliach.">
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Email</span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Password</span>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Confirm password</span>
          <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        {error ? <Notice>{error}</Notice> : null}
        {info ? <Notice tone="ok">{info}</Notice> : null}
        <Button type="submit" disabled={pending} className="h-10 w-full rounded-full">
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-mutedink">
        Already have a password? <Link href="/login" className="text-link">Sign in</Link>
      </p>
    </AuthCard>
  );
}
