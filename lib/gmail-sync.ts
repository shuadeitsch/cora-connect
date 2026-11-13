import "server-only";
import { decryptSecret } from "@/lib/mail-crypto";
import { gmailAccessToken } from "@/lib/mail-send";
import { ingestInbound, matchContactByAddress } from "@/lib/messaging-send";
import { messagingIngestKey } from "@/lib/messaging-status";
import { createClient, createEphemeralClient } from "@/lib/supabase/server";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MIN_GAP_MS = 20_000;

export type GmailSyncAccount = {
  id: string;
  org_id: string;
  user_id: string;
  email: string;
  refresh_token_cipher: string;
  refresh_token_iv: string;
  history_id: string | null;
  can_read: boolean;
};

export type GmailSyncResult = { accounts: number; ingested: number; errors: number; skipped: number };

type SaveHistory = (accountId: string, historyId: string) => Promise<void>;

const inflight = new Map<string, Promise<{ ingested: number; error: boolean; skipped: boolean }>>();
const lastDone = new Map<string, number>();

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
  const parts = Array.isArray(payload.parts) ? (payload.parts as { mimeType?: string; body?: { data?: string }; parts?: unknown }[]) : [];
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

async function syncOneAccount(
  account: GmailSyncAccount,
  saveHistory: SaveHistory,
  force: boolean,
): Promise<{ ingested: number; error: boolean; skipped: boolean }> {
  const existing = inflight.get(account.id);
  if (existing) return existing;
  if (!force && Date.now() - (lastDone.get(account.id) ?? 0) < MIN_GAP_MS) {
    return { ingested: 0, error: false, skipped: true };
  }
  const run = (async () => {
    try {
      const refresh = decryptSecret(account.refresh_token_cipher, account.refresh_token_iv);
      const access = await gmailAccessToken(refresh);
      const profile = await gmailGet(access, "/profile");
      const currentHistory = String((profile.json as { historyId?: string }).historyId ?? "");
      if (!account.history_id) {
        if (currentHistory) await saveHistory(account.id, currentHistory);
        return { ingested: 0, error: false, skipped: false };
      }
      let ingested = 0;
      let pageToken = "";
      let newHistory = currentHistory;
      const ids = new Set<string>();
      do {
        const params = new URLSearchParams({
          startHistoryId: account.history_id,
          historyTypes: "messageAdded",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const history = await gmailGet(access, `/history?${params.toString()}`);
        if (history.status === 404) {
          if (currentHistory) await saveHistory(account.id, currentHistory);
          return { ingested: 0, error: false, skipped: false };
        }
        if (!history.ok) throw new Error("Gmail history could not be read.");
        const payload = history.json as {
          history?: { messagesAdded?: { message?: { id?: string; labelIds?: string[] } }[] }[];
          historyId?: string;
          nextPageToken?: string;
        };
        for (const row of payload.history ?? []) {
          for (const added of row.messagesAdded ?? []) {
            const id = added.message?.id;
            const labels = added.message?.labelIds ?? [];
            if (id && !labels.includes("SENT") && !labels.includes("DRAFT")) ids.add(id);
          }
        }
        newHistory = String(payload.historyId ?? newHistory);
        pageToken = payload.nextPageToken ?? "";
      } while (pageToken);

      for (const id of ids) {
        const message = await gmailGet(access, `/messages/${encodeURIComponent(id)}?format=full`);
        if (!message.ok) continue;
        const payload = message.json as {
          payload?: { headers?: { name?: string; value?: string }[]; mimeType?: string; body?: { data?: string }; parts?: unknown };
          labelIds?: string[];
        };
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
      if (newHistory) await saveHistory(account.id, newHistory);
      return { ingested, error: false, skipped: false };
    } catch {
      return { ingested: 0, error: true, skipped: false };
    }
  })().finally(() => {
    inflight.delete(account.id);
    lastDone.set(account.id, Date.now());
  });
  inflight.set(account.id, run);
  return run;
}

async function syncAccountList(
  accounts: GmailSyncAccount[],
  saveHistory: SaveHistory,
  force = false,
): Promise<GmailSyncResult> {
  let ingested = 0;
  let errors = 0;
  let skipped = 0;
  for (const account of accounts) {
    const result = await syncOneAccount(account, saveHistory, force);
    ingested += result.ingested;
    if (result.error) errors += 1;
    if (result.skipped) skipped += 1;
  }
  return { accounts: accounts.length, ingested, errors, skipped };
}

/** Cron / ingest-key path: every connected readable account, all orgs. */
export async function syncGmailAccounts(opts?: { force?: boolean }): Promise<GmailSyncResult> {
  const key = messagingIngestKey();
  if (!key) return { accounts: 0, ingested: 0, errors: 0, skipped: 0 };
  const supabase = createEphemeralClient();
  const listed = await supabase.rpc("gmail_sync_accounts", { p_key: key });
  if (listed.error || !listed.data) return { accounts: 0, ingested: 0, errors: listed.error ? 1 : 0, skipped: 0 };
  return syncAccountList(listed.data as GmailSyncAccount[], async (accountId, historyId) => {
    await supabase.rpc("gmail_save_history", { p_key: key, p_account: accountId, p_history_id: historyId });
  }, Boolean(opts?.force));
}

/** Signed-in user: only Gmail accounts in their organization, incremental history API. */
export async function syncGmailAccountsForCaller(opts?: { force?: boolean }): Promise<GmailSyncResult> {
  const supabase = await createClient();
  const listed = await supabase.rpc("gmail_sync_org_accounts");
  if (listed.error || !listed.data) return { accounts: 0, ingested: 0, errors: listed.error ? 1 : 0, skipped: 0 };
  return syncAccountList(listed.data as GmailSyncAccount[], async (accountId, historyId) => {
    await supabase.rpc("gmail_save_history_org", { p_account: accountId, p_history_id: historyId });
  }, Boolean(opts?.force));
}
