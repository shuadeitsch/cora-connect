import "server-only";
import { decryptSecret } from "@/lib/mail-crypto";
import { gmailAccessToken } from "@/lib/mail-send";
import { ingestInbound, ingestUnmatched, matchContactByAddress, matchGmailReply } from "@/lib/messaging-send";
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

export type GmailSyncResult = { accounts: number; ingested: number; errors: number; skipped: number; lastError?: string };

type SaveHistory = (accountId: string, historyId: string) => Promise<void>;

type OneResult = { ingested: number; error: boolean; skipped: boolean; reason?: string };
const inflight = new Map<string, Promise<OneResult>>();
const lastListed = new Map<string, number>();
const LIST_GAP_MS = 5 * 60_000;
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

/** Obvious newsletters, notifications, no-reply and bulk mail are not worth an admin's time. */
function looksAutomated(headers: { name?: string; value?: string }[] | undefined, labels: string[], from: string): boolean {
  if (!labels.includes("INBOX")) return true;
  if (labels.some((label) => ["SPAM", "TRASH", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"].includes(label))) return true;
  if (header(headers, "List-Unsubscribe") || header(headers, "List-Id") || header(headers, "X-Auto-Response-Suppress")) return true;
  if (/^(bulk|list|junk|auto_reply)$/i.test(header(headers, "Precedence").trim())) return true;
  const auto = header(headers, "Auto-Submitted").trim().toLowerCase();
  if (auto && auto !== "no") return true;
  if (/(^|[^a-z])(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?|bounce|alerts?)([^a-z]|$)/i.test(from.split("@")[0])) return true;
  return false;
}

function fromName(raw: string): string {
  const match = raw.match(/^\s*"?([^"<]+?)"?\s*</);
  return (match?.[1] ?? "").trim();
}

function fromEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

async function syncOneAccount(
  account: GmailSyncAccount,
  saveHistory: SaveHistory,
  force: boolean,
): Promise<OneResult> {
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

      // Safety net: the history API can miss mail (stale pointer, gaps). Every few minutes also look at the last
      // 3 days of inbox mail and handle anything we have not stored yet. Ingest is deduped by Gmail message id.
      if (force || Date.now() - (lastListed.get(account.id) ?? 0) >= LIST_GAP_MS) {
        lastListed.set(account.id, Date.now());
        const recent = await gmailGet(access, `/messages?q=${encodeURIComponent("in:inbox newer_than:3d")}&maxResults=40`);
        if (!recent.ok) throw new Error(`Gmail list failed (${recent.status}).`);
        const found = ((recent.json as { messages?: { id: string }[] }).messages ?? []).map((item) => item.id).filter((item) => !ids.has(item));
        const ingestKey = messagingIngestKey();
        if (found.length && ingestKey) {
          const known = await createEphemeralClient().rpc("gmail_known_ids", { p_key: ingestKey, p_ids: found });
          const have = new Set<string>(Array.isArray(known.data) ? (known.data as string[]) : []);
          for (const item of found) if (!have.has(item)) ids.add(item);
        }
      }
      let firstIssue = "";
      for (const id of ids) {
        const message = await gmailGet(access, `/messages/${encodeURIComponent(id)}?format=full`);
        if (!message.ok) continue;
        const payload = message.json as {
          payload?: { headers?: { name?: string; value?: string }[]; mimeType?: string; body?: { data?: string }; parts?: unknown };
          labelIds?: string[];
          threadId?: string;
        };
        if ((payload.labelIds ?? []).includes("SENT")) continue;
        const from = fromEmail(header(payload.payload?.headers, "From"));
        if (!from || from === account.email.toLowerCase()) continue;
        const subject = header(payload.payload?.headers, "Subject");
        const body = plainBody(payload.payload).trim() || subject;
        const byAddress = await matchContactByAddress({ orgId: account.org_id, family: "email", address: from });
        // Not a saved address (personal email, alias, forward): fall back to the Gmail thread we sent into.
        const byThread = byAddress ? null : await matchGmailReply({ threadId: String(payload.threadId ?? ""), messageId: id });
        const match = byAddress ?? byThread;
        if (!match) {
          // Neither a saved address nor a thread we sent into. Keep real-looking mail addressed to this mailbox for an admin.
          const heads = payload.payload?.headers;
          const addressedHere = `${header(heads, "To")},${header(heads, "Cc")}`.toLowerCase().includes(account.email.toLowerCase());
          if (addressedHere && !looksAutomated(heads, payload.labelIds ?? [], from)) {
            await ingestUnmatched({
              orgId: account.org_id,
              channelType: "email_gmail",
              address: from,
              senderName: fromName(header(heads, "From")),
              subject,
              body,
              provider: "gmail",
              providerMessageId: id,
            });
          }
          continue;
        }
        const result = await ingestInbound({
          orgId: match.orgId,
          householdId: match.householdId,
          personId: match.personId || null,
          channelType: "email_gmail",
          contactAddress: byThread ? byThread.contactAddress : from,
          body,
          subject,
          provider: "gmail",
          providerMessageId: id,
        });
        if ("id" in result) ingested += 1;
        else if (!firstIssue) firstIssue = `Could not save a reply: ${String(result.error).slice(0, 100)}`;
      }
      if (newHistory) await saveHistory(account.id, newHistory);
      return { ingested, error: Boolean(firstIssue), skipped: false, reason: firstIssue || undefined };
    } catch (error) {
      return { ingested: 0, error: true, skipped: false, reason: (error instanceof Error ? error.message : "Gmail sync failed.").slice(0, 140) };
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
  let lastError: string | undefined;
  for (const account of accounts) {
    const result = await syncOneAccount(account, saveHistory, force);
    ingested += result.ingested;
    if (result.error) {
      errors += 1;
      lastError = result.reason ?? "Gmail sync failed.";
    }
    if (result.skipped) skipped += 1;
  }
  return { accounts: accounts.length, ingested, errors, skipped, lastError };
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

/** TEMPORARY: counts and reasons only (no bodies, no tokens) for the last 2 days of mail in the connected mailbox. */
export async function diagnoseGmail() {
  const key = messagingIngestKey();
  if (!key) return { error: "no ingest key" };
  const supabase = createEphemeralClient();
  const listed = await supabase.rpc("gmail_sync_accounts", { p_key: key });
  if (listed.error || !listed.data) return { error: listed.error?.message ?? "no accounts" };
  const out: unknown[] = [];
  for (const account of listed.data as GmailSyncAccount[]) {
    const info: Record<string, unknown> = { storedHistory: account.history_id, canRead: account.can_read };
    try {
      const refresh = decryptSecret(account.refresh_token_cipher, account.refresh_token_iv);
      const access = await gmailAccessToken(refresh);
      info.token = "ok";
      const profile = await gmailGet(access, "/profile");
      info.profile = { status: profile.status, historyId: (profile.json as { historyId?: string }).historyId, total: (profile.json as { messagesTotal?: number }).messagesTotal };
      const hist = await gmailGet(access, `/history?startHistoryId=${account.history_id}&historyTypes=messageAdded`);
      info.historyFromStored = { status: hist.status, records: ((hist.json as { history?: unknown[] }).history ?? []).length };
      const list = await gmailGet(access, `/messages?q=${encodeURIComponent("newer_than:2d -in:sent")}&maxResults=40`);
      const ids = ((list.json as { messages?: { id: string }[] }).messages ?? []).map((m) => m.id);
      info.listed = { status: list.status, count: ids.length };
      const rows: unknown[] = [];
      for (const id of ids) {
        const message = await gmailGet(access, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe&metadataHeaders=Precedence&metadataHeaders=In-Reply-To&metadataHeaders=Auto-Submitted`);
        const payload = message.json as { labelIds?: string[]; threadId?: string; internalDate?: string; payload?: { headers?: { name?: string; value?: string }[] } };
        const heads = payload.payload?.headers;
        const from = fromEmail(header(heads, "From"));
        const byAddress = await matchContactByAddress({ orgId: account.org_id, family: "email", address: from });
        const byThread = byAddress ? null : await matchGmailReply({ threadId: String(payload.threadId ?? ""), messageId: id });
        const toHere = `${header(heads, "To")},${header(heads, "Cc")}`.toLowerCase().includes(account.email.toLowerCase());
        const known = await supabase.rpc("gmail_known_ids", { p_key: key, p_ids: [id] });
        rows.push({
          at: new Date(Number(payload.internalDate ?? 0)).toISOString().slice(5, 16),
          labels: (payload.labelIds ?? []).join(","),
          from: `${from.slice(0, 2)}***@${from.split("@")[1] ?? ""}`,
          savedContact: Boolean(byAddress),
          threadWeSentInto: Boolean(byThread),
          inReplyTo: Boolean(header(heads, "In-Reply-To")),
          toHere,
          automated: looksAutomated(heads, payload.labelIds ?? [], from),
          alreadyInCrm: known.error ? `err:${known.error.message.slice(0, 40)}` : Array.isArray(known.data) && known.data.length > 0,
        });
      }
      info.messages = rows;
    } catch (error) {
      info.error = error instanceof Error ? error.message : "failed";
    }
    out.push(info);
  }
  return { accounts: out };
}
