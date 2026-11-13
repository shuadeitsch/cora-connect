import "server-only";
import { decryptSecret } from "@/lib/mail-crypto";
import { gmailAccessToken } from "@/lib/mail-send";
import { ingestInbound, matchContactByAddress } from "@/lib/messaging-send";
import { messagingIngestKey } from "@/lib/messaging-status";
import { createEphemeralClient } from "@/lib/supabase/server";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailGet(access: string, path: string) {
  const res = await fetch(`${GMAIL_API}${path}`, { headers: { Authorization: `Bearer ${access}` } });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

function header(headers: { name?: string; value?: string }[] | undefined, name: string): string {
  return headers?.find((item) => (item.name ?? "").toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodePart(data?: string): string {
  if (!data) return "";
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function plainBody(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown } | undefined): string {
  if (!payload) return "";
  if ((payload.mimeType ?? "").startsWith("text/plain") && payload.body?.data) return decodePart(payload.body.data);
  const parts = Array.isArray(payload.parts) ? payload.parts as { mimeType?: string; body?: { data?: string }; parts?: unknown }[] : [];
  for (const part of parts) {
    const text = plainBody(part);
    if (text.trim()) return text;
  }
  if (payload.body?.data) return decodePart(payload.body.data);
  return "";
}

function fromEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

export async function syncGmailAccounts(): Promise<{ accounts: number; ingested: number; errors: number }> {
  const key = messagingIngestKey();
  if (!key) return { accounts: 0, ingested: 0, errors: 0 };
  const supabase = createEphemeralClient();
  const listed = await supabase.rpc("gmail_sync_accounts", { p_key: key });
  if (listed.error || !listed.data) return { accounts: 0, ingested: 0, errors: listed.error ? 1 : 0 };
  let ingested = 0;
  let errors = 0;
  const accounts = listed.data as {
    id: string;
    org_id: string;
    user_id: string;
    email: string;
    refresh_token_cipher: string;
    refresh_token_iv: string;
    history_id: string | null;
    can_read: boolean;
  }[];
  for (const account of accounts) {
    try {
      const refresh = decryptSecret(account.refresh_token_cipher, account.refresh_token_iv);
      const access = await gmailAccessToken(refresh);
      const profile = await gmailGet(access, "/profile");
      const currentHistory = String((profile.json as { historyId?: string }).historyId ?? "");
      if (!account.history_id) {
        if (currentHistory) await supabase.rpc("gmail_save_history", { p_key: key, p_account: account.id, p_history_id: currentHistory });
        continue;
      }
      const history = await gmailGet(access, `/history?startHistoryId=${encodeURIComponent(account.history_id)}&historyTypes=messageAdded`);
      if (history.status === 404) {
        if (currentHistory) await supabase.rpc("gmail_save_history", { p_key: key, p_account: account.id, p_history_id: currentHistory });
        continue;
      }
      const records = ((history.json as { history?: { messagesAdded?: { message?: { id?: string; labelIds?: string[] } }[] }[] }).history ?? []);
      const ids = new Set<string>();
      for (const row of records) {
        for (const added of row.messagesAdded ?? []) {
          const id = added.message?.id;
          const labels = added.message?.labelIds ?? [];
          if (id && !labels.includes("SENT") && !labels.includes("DRAFT")) ids.add(id);
        }
      }
      for (const id of ids) {
        const message = await gmailGet(access, `/messages/${encodeURIComponent(id)}?format=full`);
        if (!message.ok) continue;
        const payload = (message.json as { payload?: { headers?: { name?: string; value?: string }[]; mimeType?: string; body?: { data?: string }; parts?: unknown }; labelIds?: string[] });
        if ((payload.labelIds ?? []).includes("SENT")) continue;
        const from = fromEmail(header(payload.payload?.headers, "From"));
        if (!from || from === account.email.toLowerCase()) continue;
        const subject = header(payload.payload?.headers, "Subject");
        const body = plainBody(payload.payload).trim() || subject;
        const match = await matchContactByAddress({ orgId: account.org_id, family: "email", address: from });
        if (!match) continue;
        const result = await ingestInbound({
          orgId: match.orgId,
          householdId: match.householdId,
          personId: match.personId,
          channelType: "email_gmail",
          contactAddress: from,
          body,
          subject,
          provider: "gmail",
          providerMessageId: id,
        });
        if ("id" in result) ingested += 1;
      }
      const newHistory = String((history.json as { historyId?: string }).historyId ?? currentHistory);
      if (newHistory) await supabase.rpc("gmail_save_history", { p_key: key, p_account: account.id, p_history_id: newHistory });
    } catch {
      errors += 1;
    }
  }
  return { accounts: accounts.length, ingested, errors };
}
