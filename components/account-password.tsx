"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "@/lib/actions";

export function AccountPassword({ name, email, recovery }: { name: string; email: string; recovery: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
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
    const result = await changePasswordAction(current, next, confirm);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setInfo(result.warning ?? "Password updated.");
    router.refresh();
  }

  return (
    <form className="grid max-w-xl gap-3 panel rounded-3xl p-4" data-tour="settings-account" onSubmit={(event) => void submit(event)}>
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Password</h2>
        <p className="mt-1 text-sm text-mutedink">{name} · {email}</p>
      </div>
      {recovery ? <Notice tone="ok">Choose a new password to finish resetting this account.</Notice> : null}
      {recovery ? null : (
        <label className="grid gap-1 text-sm">
          <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Current password</span>
          <Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required autoComplete="current-password" />
        </label>
      )}
      <label className="grid gap-1 text-sm">
        <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">New password</span>
        <Input type="password" value={next} onChange={(event) => setNext(event.target.value)} required minLength={8} autoComplete="new-password" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Confirm new password</span>
        <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} autoComplete="new-password" />
      </label>
      {error ? <Notice>{error}</Notice> : null}
      {info ? <Notice tone="ok">{info}</Notice> : null}
      <div>
        <Button type="submit" disabled={pending} className="rounded-full">
          {pending ? "Saving…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
