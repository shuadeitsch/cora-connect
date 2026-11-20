import { messagingSetupStatus, smsSendingEnabled, twilioFromNumber, twilioWhatsappNumber, whatsappApiSendingEnabled } from "@/lib/messaging-status";

/** Client-safe booleans only. Secrets stay in server env and are never returned. */
export function mailSetupStatus() {
  const messaging = messagingSetupStatus();
  return {
    gmail: messaging.gmail,
    resend: messaging.resend,
    sms: messaging.sms,
    whatsapp: messaging.whatsapp,
    smsSendingEnabled: smsSendingEnabled(),
    whatsappApiSendingEnabled: whatsappApiSendingEnabled(),
    // Sender numbers (not secrets) and whether browser calling has its Twilio keys, for the plain status lines in Settings.
    smsFrom: twilioFromNumber() ?? "",
    whatsappFrom: (twilioWhatsappNumber() ?? "").replace(/^whatsapp:/i, ""),
    voice: Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_API_KEY_SID?.trim() && process.env.TWILIO_API_KEY_SECRET?.trim() && process.env.TWILIO_TWIML_APP_SID?.trim()),
  };
}

export function mailTokenKeyConfigured() {
  return Boolean(process.env.MAIL_TOKEN_ENCRYPTION_KEY?.trim());
}
