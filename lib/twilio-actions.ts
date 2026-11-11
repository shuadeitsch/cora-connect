"use server";

import { twilioEnvConfigured } from "@/lib/twilio-status";

/** Boolean only — never returns secret values. */
export async function getTwilioStatusAction(): Promise<{ connected: boolean }> {
  return { connected: twilioEnvConfigured() };
}
