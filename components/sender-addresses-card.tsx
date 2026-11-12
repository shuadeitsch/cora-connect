"use client";

import { useState, useTransition } from "react";
import { usePractice } from "@/components/practice-provider";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useUndoToast } from "@/components/undo-toast";
import { deleteOutreachSenderAction, saveOutreachSenderAction, saveOutreachTextSettingsAction } from "@/lib/actions";
import { isGoogleSender, isValidSenderEmail, normalizeSenderEmail } from "@/lib/outreach";
import type { OutreachSender, OutreachTextSettings, TextFromMode } from "@/lib/types";

export function SenderAddressesCard({ senders, loginEmail, textSettings }: { senders: OutreachSender[]; loginEmail?: string; textSettings?: OutreachTextSettings | null }) {
  const announce = useUndoToast();
  const practice = usePractice();
  const [email, setEmail] = useState("");
  const [isGoogle, setIsGoogle] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const googleGuess = isGoogleSender(email, isGoogle);
  const [textFrom, setTextFrom] = useState<TextFromMode>(textSettings?.textFrom ?? "sms");
  const [voiceNumber, setVoiceNumber] = useState(textSettings?.googleVoiceNumber ?? "");

  function saveText(next: TextFromMode, number = voiceNumber) {
    setTextFrom(next);
    start(async () => {
      if (practice.active) {
        announce({ ok: true }, "Text setting saved");
        return;
      }
      const result = await saveOutreachTextSettingsAction({ textFrom: next, googleVoiceNumber: number });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      announce(result, "Text setting saved");
    });
  }


  return (
    <section className="mt-4 grid max-w-2xl gap-3 panel rounded-3xl p-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Text from</h2>
        <p className="text-sm text-muted-foreground">
          Choose whether texts open in your phone&apos;s messaging app or in Google Voice. WhatsApp always uses the number your WhatsApp is registered to.
        </p>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Text from</span>
        <select
          className="h-11 rounded-xl border border-input bg-card px-3 text-base sm:text-sm"
          value={textFrom}
          onChange={(event) => saveText(event.target.value as TextFromMode)}
          aria-label="Text from"
        >
          <option value="sms">Phone&apos;s messaging app</option>
          <option value="google_voice">Google Voice{voiceNumber ? ` ${voiceNumber}` : ""}</option>
        </select>
      </label>
      {textFrom === "google_voice" ? (
        <label className="grid gap-1 text-sm">
          <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">Google Voice number</span>
          <Input
            className="min-h-11"
            value={voiceNumber}
            onChange={(event) => setVoiceNumber(event.target.value)}
            onBlur={() => saveText("google_voice", voiceNumber)}
            placeholder="(347) 770-1863"
          />
        </label>
      ) : null}

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">Send email from</h2>
        <p className="text-sm text-muted-foreground">
          Save the addresses you send outreach from. If an address is Gmail or Google Workspace, Open in email uses Gmail for that account. These addresses stay private to you.
        </p>
      </div>
      <ul className="grid gap-2">
        {senders.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{item.email}</p>
              <p className="text-xs text-muted-foreground">{isGoogleSender(item.email, item.isGoogle) ? "Opens in Gmail" : "Opens in your mail app"}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full"
              disabled={pending}
              onClick={() => start(async () => {
                if (practice.active) {
                  announce({ ok: true }, "Address removed");
                  return;
                }
                const result = await deleteOutreachSenderAction(item.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                announce(result, "Address removed");
              })}
            >
              Remove
            </Button>
          </li>
        ))}
        {!senders.length ? <li className="text-sm text-muted-foreground">No saved addresses yet.{loginEmail ? ` You can add ${loginEmail}.` : ""}</li> : null}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const value = normalizeSenderEmail(email);
          if (!isValidSenderEmail(value)) {
            setError("Enter a valid email address.");
            return;
          }
          start(async () => {
            if (practice.active) {
              announce({ ok: true }, "Address saved");
              setEmail("");
              setError("");
              return;
            }
            const result = await saveOutreachSenderAction({ email: value, isGoogle: googleGuess });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            announce(result, "Address saved");
            setEmail("");
            setIsGoogle(false);
            setError("");
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          <span className="text-[11px] font-medium tracking-wide text-mutedink uppercase">New address</span>
          <Input
            type="email"
            className="min-h-11"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              const next = event.target.value;
              if (isGoogleSender(next, false)) setIsGoogle(true);
            }}
            placeholder={loginEmail || "you@example.com"}
          />
        </label>
        <Button type="submit" className="min-h-11 rounded-full" disabled={pending}>
          {pending ? "Saving…" : "Save address"}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
          <Checkbox checked={googleGuess} onCheckedChange={(value) => setIsGoogle(Boolean(value))} />
          This is a Gmail or Google Workspace address
        </label>
        {error ? <div className="sm:col-span-2"><Notice>{error}</Notice></div> : null}
      </form>
    </section>
  );
}
