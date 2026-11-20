"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTwilioAdmin } from "@/lib/twilio-admin";

type Result = { ok: true } | { ok: false; error: string };
type Loose = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
};

export async function saveTopupSettingsAction(input: { enabled: boolean; threshold: number | null; amount: number | null }): Promise<Result> {
  const access = await requireTwilioAdmin();
  if (!access.ok) return { ok: false, error: access.error };
  const threshold = input.threshold == null ? null : money(input.threshold);
  const amount = input.amount == null ? null : money(input.amount);
  if ((input.threshold != null && threshold == null) || (input.amount != null && amount == null)) return { ok: false, error: "Enter valid dollar amounts." };
  if (input.enabled && (threshold == null || amount == null || amount <= 0)) return { ok: false, error: "Auto top-up needs a threshold and an amount." };
  const db = (await createClient()) as unknown as Loose;
  const { error } = await db.from("admin_twilio_settings").upsert({ org_id: access.orgId, topup_enabled: input.enabled, topup_threshold: threshold, topup_amount: amount, updated_by: access.userId, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: "Couldn't save the top-up settings." } : { ok: true };
}

export async function addTwilioPaymentAction(input: { paidOn: string; amount: number; note: string }): Promise<Result> {
  const access = await requireTwilioAdmin();
  if (!access.ok) return { ok: false, error: access.error };
  const amount = money(input.amount);
  if (!amount || amount <= 0) return { ok: false, error: "Enter the amount paid." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) return { ok: false, error: "Pick the date paid." };
  const db = (await createClient()) as unknown as Loose;
  const { error } = await db.from("admin_twilio_payments").insert({ org_id: access.orgId, paid_on: input.paidOn, amount, note: (input.note ?? "").slice(0, 200), created_by: access.userId });
  return error ? { ok: false, error: "Couldn't save that payment." } : { ok: true };
}

export async function removeTwilioPaymentAction(id: string): Promise<Result> {
  const access = await requireTwilioAdmin();
  if (!access.ok) return { ok: false, error: access.error };
  const db = (await createClient()) as unknown as Loose;
  const { error } = await db.from("admin_twilio_payments").delete().eq("id", id).eq("org_id", access.orgId);
  return error ? { ok: false, error: "Couldn't remove that payment." } : { ok: true };
}
