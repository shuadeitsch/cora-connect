import "server-only";
import { unstable_cache } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { readPreview } from "@/lib/preview";
import { createClient, isSupabaseMode } from "@/lib/supabase/server";

/** Strictly admins: a real admin session, not Beta View as shliach/bochur. Checked on the server for every call. */
export async function requireTwilioAdmin(): Promise<{ ok: true; orgId: string; userId: string } | { ok: false; status: 401 | 403; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Sign in again." };
  if (user.role !== "admin" || (await readPreview())) return { ok: false, status: 403, error: "Admins only." };
  return { ok: true, orgId: user.orgId, userId: user.id };
}

export type UsageLine = { count: number; usage: number; unit: string; price: number };
export type UsagePeriod = {
  start: string;
  total: number;
  calls: UsageLine;
  sms: UsageLine;
  whatsapp: UsageLine;
  recordings: UsageLine;
  phoneNumbers: UsageLine;
  /** One-time fees (such as registration) that should not count toward the monthly pace. */
  oneTime: number;
};
export type TwilioLive = {
  fetchedAt: string;
  balance: number | null;
  currency: string;
  thisMonth: UsagePeriod | null;
  allTime: UsagePeriod | null;
  errors: string[];
};

type Record_ = { category: string; count: string; usage: string; usage_unit: string; price: string; start_date: string };

const empty = (): UsageLine => ({ count: 0, usage: 0, unit: "", price: 0 });

function line(records: Record_[], ...categories: string[]): UsageLine {
  const out = empty();
  for (const category of categories) {
    const hit = records.find((record) => record.category === category);
    if (!hit) continue;
    out.count += Number(hit.count) || 0;
    out.usage += Number(hit.usage) || 0;
    out.price += Number(hit.price) || 0;
    out.unit = out.unit || hit.usage_unit;
  }
  return out;
}

function period(records: Record_[]): UsagePeriod {
  const total = records.find((record) => record.category === "totalprice");
  const oneTime = Math.max(0, ...records.filter((record) => record.usage_unit === "one-time").map((record) => Number(record.price) || 0));
  return {
    start: records[0]?.start_date ?? "",
    total: Number(total?.price) || 0,
    calls: line(records, "calls"),
    sms: line(records, "sms"),
    // Messages in and out; the cost sits on the conversation categories.
    whatsapp: (() => {
      const messages = line(records, "channels-whatsapp-outbound", "channels-whatsapp-inbound");
      const cost = line(records, "channels-whatsapp");
      return { count: messages.count, usage: messages.usage, unit: "messages", price: cost.price };
    })(),
    recordings: line(records, "recordings"),
    phoneNumbers: line(records, "phonenumbers"),
    oneTime,
  };
}

async function twilioGet(path: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) throw new Error("Twilio isn't connected.");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Twilio answered ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

async function loadLive(): Promise<TwilioLive> {
  const errors: string[] = [];
  const attempt = async <T,>(label: string, work: () => Promise<T>): Promise<T | null> => {
    try { return await work(); } catch (error) { errors.push(`${label}: ${error instanceof Error ? error.message : "failed"}`); return null; }
  };
  const [balance, month, all] = await Promise.all([
    attempt("Balance", () => twilioGet("/Balance.json")),
    attempt("This month usage", () => twilioGet("/Usage/Records/ThisMonth.json?PageSize=1000")),
    attempt("All-time usage", () => twilioGet("/Usage/Records/AllTime.json?PageSize=1000")),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    balance: balance ? Number(balance.balance) : null,
    currency: String(balance?.currency ?? "USD"),
    thisMonth: month ? period(month.usage_records as Record_[]) : null,
    allTime: all ? period(all.usage_records as Record_[]) : null,
    errors,
  };
}

/** Twilio is only called about every 5 minutes, however many admins look. Only reached after the admin check. */
export const getTwilioLive = unstable_cache(loadLive, ["admin-twilio-live-v1"], { revalidate: 300 });

export type TopupSettings = { enabled: boolean; threshold: number | null; amount: number | null; updatedAt: string | null };
export type PaymentRow = { id: string; paidOn: string; amount: number; note: string };

type Loose = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function loadAdminTables(): Promise<{ settings: TopupSettings; payments: PaymentRow[]; error?: string }> {
  const settings: TopupSettings = { enabled: false, threshold: null, amount: null, updatedAt: null };
  if (!isSupabaseMode()) return { settings, payments: [] };
  const db = (await createClient()) as unknown as Loose;
  const [s, p] = await Promise.all([
    db.from("admin_twilio_settings").select("*").maybeSingle(),
    db.from("admin_twilio_payments").select("id, paid_on, amount, note").order("paid_on", { ascending: false }).limit(200),
  ]);
  if (s.data) {
    settings.enabled = Boolean(s.data.topup_enabled);
    settings.threshold = s.data.topup_threshold == null ? null : Number(s.data.topup_threshold);
    settings.amount = s.data.topup_amount == null ? null : Number(s.data.topup_amount);
    settings.updatedAt = s.data.updated_at ?? null;
  }
  const payments: PaymentRow[] = (p.data ?? []).map((row: { id: string; paid_on: string; amount: string; note: string }) => ({ id: row.id, paidOn: row.paid_on, amount: Number(row.amount), note: row.note }));
  return { settings, payments, error: s.error || p.error ? "Couldn't read the saved top-up settings or payments." : undefined };
}

/** Rough days of balance left at this month's pace (one-time fees left out). Null when there isn't enough spending to tell. */
export function estimateDaysLeft(live: TwilioLive, now = new Date()): { perDay: number | null; days: number | null } {
  if (live.balance == null || !live.thisMonth) return { perDay: null, days: null };
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", day: "numeric" }).format(now);
  const elapsed = Math.max(1, Number(parts) || 1);
  const perDay = Math.max(0, live.thisMonth.total - live.thisMonth.oneTime) / elapsed;
  if (perDay < 0.005) return { perDay, days: null };
  return { perDay, days: Math.floor(live.balance / perDay) };
}
