import "server-only";

/**
 * Org/platform flag: all three server env vars are present.
 * Per-person accounts are not stored yet; this is the hook so the UI can later
 * switch "Send through Twilio" to real sending without a redesign.
 */
export function twilioEnvConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim(),
  );
}
