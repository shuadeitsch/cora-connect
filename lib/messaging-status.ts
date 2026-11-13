/** Client-safe booleans only. Secrets stay in server env and are never returned. */
export function messagingSetupStatus() {
  const sid = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim());
  return {
    gmail: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    resend: Boolean(process.env.RESEND_API_KEY?.trim()),
    sms: sid && Boolean(process.env.TWILIO_FROM_NUMBER?.trim()),
    whatsapp: sid && Boolean(process.env.TWILIO_WHATSAPP_NUMBER?.trim()),
    ingest: Boolean(process.env.MESSAGING_INGEST_KEY?.trim()),
  };
}

export function messagingIngestKey(): string | null {
  const key = process.env.MESSAGING_INGEST_KEY?.trim();
  return key && key.length >= 16 ? key : null;
}

export function twilioFromNumber(): string | null {
  const raw = process.env.TWILIO_FROM_NUMBER?.trim();
  return raw || null;
}

export function twilioWhatsappNumber(): string | null {
  const raw = process.env.TWILIO_WHATSAPP_NUMBER?.trim();
  return raw || null;
}

export function twilioPhoneSid(): string | null {
  return process.env.TWILIO_PHONE_SID?.trim() || process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || null;
}
