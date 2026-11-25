import "server-only";
import { canMessageRole, MESSAGING_BLOCKED_MESSAGE } from "@/lib/messaging-access";
import { sendCampaignMessage } from "@/lib/messaging-repo";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser, loadDatabase } from "@/lib/session";
import { loadSupabase } from "@/lib/supabase/load";
import { createClient } from "@/lib/supabase/server";
import type { Database, User } from "@/lib/types";

export type BulkSendItem = Parameters<typeof sendCampaignMessage>[1] & { name: string };

export type BulkSendJob = {
  id: string;
  label: string;
  status: "running" | "done" | "stopped";
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
  finishedAt: string | null;
  /** True when no worker holds the job (it timed out or the server restarted): any open CRM page may resume it. */
  stalled: boolean;
  results?: { name: string; ok: boolean; error?: string | null }[];
};

const MAX_ITEMS = 1000;

export async function bulkSendUser(): Promise<{ ok: true; user: User } | { ok: false; error: string; status: number }> {
  const gate = await assertNotPreview();
  if (!gate.ok) return { ok: false, error: gate.error, status: 403 };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again.", status: 401 };
  if (!canMessageRole(user.role)) return { ok: false, error: MESSAGING_BLOCKED_MESSAGE, status: 403 };
  return { ok: true, user };
}

function toJob(row: Record<string, unknown>, withResults = false): BulkSendJob {
  const lease = row.lease_until ? Date.parse(String(row.lease_until)) : 0;
  const status = (row.status === "done" || row.status === "stopped" ? row.status : "running") as BulkSendJob["status"];
  return {
    id: String(row.id),
    label: String(row.label ?? ""),
    status,
    total: Number(row.total ?? 0),
    sent: Number(row.sent ?? 0),
    failed: Number(row.failed ?? 0),
    createdAt: String(row.created_at ?? ""),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    stalled: status === "running" && (!lease || lease < Date.now()),
    results: withResults && Array.isArray(row.results) ? (row.results as BulkSendJob["results"]) : undefined,
  };
}

export async function createBulkSendJob(user: User, label: string, items: BulkSendItem[]): Promise<string> {
  if (!items.length) throw new Error("No one is selected to message.");
  if (items.length > MAX_ITEMS) throw new Error(`Send to at most ${MAX_ITEMS} people at a time.`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bulk_send_jobs")
    .insert({ org_id: user.orgId, created_by: user.id, label: label.slice(0, 120), items, total: items.length, lease_until: new Date(Date.now() + 90_000).toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not start the send.");
  return String(data.id);
}

/** This sender's recent jobs: running ones, plus ones that finished in the last 10 minutes. */
export async function listBulkSendJobs(user: User): Promise<BulkSendJob[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("bulk_send_jobs")
    .select("id, label, status, total, sent, failed, next_index, created_at, finished_at, lease_until")
    .eq("created_by", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  const recent = Date.now() - 10 * 60 * 1000;
  const rows = data ?? [];
  // Every message was handed out but a worker stopped before saving its result: close the job instead of spinning forever.
  for (const row of rows) {
    const job = toJob(row);
    if (job.stalled && Number(row.next_index ?? 0) >= job.total) {
      const missing = Math.max(0, job.total - job.sent - job.failed);
      const now = new Date().toISOString();
      await supabase.from("bulk_send_jobs").update({ status: "done", failed: job.failed + missing, finished_at: now, updated_at: now }).eq("id", job.id).eq("status", "running");
      row.status = "done";
      row.failed = job.failed + missing;
      row.finished_at = now;
    }
  }
  return rows.map((row) => toJob(row)).filter((job) => job.status === "running" || (job.finishedAt && Date.parse(job.finishedAt) > recent));
}

export async function getBulkSendJob(id: string): Promise<BulkSendJob | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("bulk_send_jobs").select("*").eq("id", id).maybeSingle();
  return data ? toJob(data, true) : null;
}

/** Take the job if no worker holds it (lease expired). Returns false if another worker is already sending. */
export async function takeBulkSendJob(id: string): Promise<boolean> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("bulk_send_jobs")
    .update({ lease_until: new Date(Date.now() + 90_000).toISOString(), updated_at: now })
    .eq("id", id)
    .eq("status", "running")
    .or(`lease_until.is.null,lease_until.lt.${now}`)
    .select("id");
  return Boolean(data?.length);
}

/** Send messages one at a time until the job is finished or the time budget runs out (another page resumes it). */
export async function runBulkSendJob(user: User, id: string, budgetMs = 240_000) {
  const supabase = await createClient();
  const stopAt = Date.now() + budgetMs;
  let db: Database | null = null;
  let sinceLoad = 0;
  while (Date.now() < stopAt) {
    const claimed = await supabase.rpc("claim_bulk_send_item", { p_job: id });
    const row = Array.isArray(claimed.data) ? claimed.data[0] : null;
    if (claimed.error || !row || !row.item) break;
    const item = row.item as BulkSendItem;
    // Reload contacts every 25 messages so a fresh STOP or removal is honored mid-send.
    if (!db || sinceLoad >= 25) {
      db = await loadSupabase(user).catch(() => null) ?? await loadDatabase();
      sinceLoad = 0;
    }
    sinceLoad += 1;
    let ok = false;
    let error: string | null = null;
    try {
      const { name, ...input } = item;
      void name;
      const result = await sendCampaignMessage(user, input, db);
      ok = result.ok;
      error = result.ok ? null : result.error;
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not send.";
    }
    await supabase.rpc("finish_bulk_send_item", { p_job: id, p_ok: ok, p_name: item.name || "Contact", p_error: error });
  }
}
