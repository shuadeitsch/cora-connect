"use client";

import { TWILIO_SETUP_NOTE, TWILIO_SIGNUP_URL } from "@/lib/twilio";

/** Status + signup link for admins and shluchim. No key fields. */
export function TwilioSettingsCard({ connected }: { connected: boolean }) {
  return (
    <section className="panel mt-4 max-w-xl rounded-3xl p-4" aria-label="Texting (Twilio)">
      <h2 className="font-heading text-lg font-semibold text-foreground">Texting (Twilio)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Status: <span className="font-medium text-foreground">{connected ? "Connected" : "Not connected"}</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{TWILIO_SETUP_NOTE}</p>
      <a
        href={TWILIO_SIGNUP_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:bg-muted"
      >
        Create a Twilio account
      </a>
    </section>
  );
}
