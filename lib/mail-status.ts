import { messagingSetupStatus } from "@/lib/messaging-status";

/** Client-safe booleans only. Secrets stay in server env and are never returned. */
export function mailSetupStatus() {
  const messaging = messagingSetupStatus();
  return {
    gmail: messaging.gmail,
    resend: messaging.resend,
    sms: messaging.sms,
    whatsapp: messaging.whatsapp,
  };
}

export function mailTokenKeyConfigured() {
  return Boolean(process.env.MAIL_TOKEN_ENCRYPTION_KEY?.trim());
}
