/** Client-safe booleans only. Secrets stay in server env and are never returned. */
export function mailSetupStatus() {
  return {
    gmail: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    resend: Boolean(process.env.RESEND_API_KEY?.trim()),
  };
}

export function mailTokenKeyConfigured() {
  return Boolean(process.env.MAIL_TOKEN_ENCRYPTION_KEY?.trim());
}
