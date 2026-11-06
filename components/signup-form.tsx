"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/lib/actions";
import { CONTACT_PROJECTS, FOCUS_STATES } from "@/lib/constants";

const STATES = FOCUS_STATES.filter((item) => item.code !== "Unsorted");

export function SignupForm({ initialEmail }: { initialEmail: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState("");
  const [project, setProject] = useState("");
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
    const result = await signUpAction(name, email, password, confirm, state, project);
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
    <AuthCard title="Create a Cora Connect account" subtitle="Use the email on your invite. An invite approves you with the role your admin chose. Shluchim pick their state; bochurim pick which project they are here for.">
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
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">State (shluchim)</span>
          <select
            aria-label="State"
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="">Skip if you are a bochur</option>
            {STATES.map((item) => (
              <option key={item.code} value={item.code}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-mutedink uppercase">Which project are you here for? (bochurim)</span>
          <select
            aria-label="Project"
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          >
            <option value="">Skip if you are a shliach</option>
            {CONTACT_PROJECTS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
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
        {info ? <Notice tone={info ? "ok" : "error"}>{info}</Notice> : null}
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
