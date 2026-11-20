/**
 * One switch for who may use messaging (email, text, WhatsApp, tap-to-send, Inbox, replies, calls).
 *
 * Set MESSAGING_ROLES to a comma-separated list of roles, e.g. "admin" (default) or "admin,shliach,bochur".
 * Everything else (UI, server actions, API routes) goes through canMessageRole / viewer.canMessage, so flipping
 * this one env var on Vercel (then redeploying) turns messaging on for more roles.
 */
const DEFAULT_ROLES = ["admin"];

export function messagingRoles(): string[] {
  const raw = process.env.MESSAGING_ROLES;
  if (raw === undefined || !raw.trim()) return DEFAULT_ROLES;
  return raw.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function canMessageRole(role: string | null | undefined): boolean {
  return messagingRoles().includes((role ?? "").trim().toLowerCase());
}

export const MESSAGING_BLOCKED_MESSAGE = "Messaging is only available to CORA Connect admins for now.";
