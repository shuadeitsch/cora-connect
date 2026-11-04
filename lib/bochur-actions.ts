"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; count?: number } | { ok: false; error: string };

// The database (RLS and the profile trigger) decides who may do each of these.
// A shliach only reaches his own bochurim; an admin reaches everyone.

async function who() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "shliach") return null;
  return user;
}

function monthFromToday() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function done(paths: string[] = ["/team", "/users"]): Result {
  for (const path of paths) revalidatePath(path);
  return { ok: true };
}

async function updateBochur(id: string, patch: Record<string, unknown>, failText: string): Promise<Result> {
  const user = await who();
  if (!user) return { ok: false, error: "Only a shliach or a Cora Connect admin can do that." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).eq("role", "bochur").select("id, status, expires_at");
  if (error) return { ok: false, error: error.message.includes("Cora admin") ? error.message : failText };
  if (!data?.length) return { ok: false, error: failText };
  return done();
}

/** Final approval by his shliach. Access runs one month from today. */
export async function approveBochurAction(id: string) {
  return updateBochur(id, { status: "approved", expires_at: monthFromToday() }, "Couldn't approve. A Cora Connect admin has to approve him first.");
}

/** Another month from today. Also turns a disabled or expired bochur back on. */
export async function extendBochurAction(id: string) {
  return updateBochur(id, { status: "approved", expires_at: monthFromToday() }, "Couldn't extend his access.");
}

export async function disableBochurAction(id: string) {
  return updateBochur(id, { status: "disabled" }, "Couldn't disable his access.");
}

/** Share or unshare many contacts with one bochur. */
export async function shareWithBochurAction(householdIds: string[], bochurId: string, share: boolean): Promise<Result> {
  const user = await who();
  if (!user) return { ok: false, error: "Only a shliach or a Cora Connect admin can share contacts." };
  if (!householdIds.length || !bochurId) return { ok: false, error: "Pick contacts and a bochur." };
  const supabase = await createClient();
  if (share) {
    const rows = householdIds.map((household_id) => ({ household_id, bochur_id: bochurId, org_id: user.orgId, shared_by: user.id }));
    const { data, error } = await supabase.from("contact_shares").upsert(rows, { onConflict: "household_id,bochur_id", ignoreDuplicates: true }).select("household_id");
    if (error) return { ok: false, error: "Couldn't share those contacts. You can share only your own contacts with your own bochurim." };
    revalidatePath("/households");
    return { ok: true, count: data?.length ?? 0 };
  }
  const { data, error } = await supabase.from("contact_shares").delete().eq("bochur_id", bochurId).in("household_id", householdIds).select("household_id");
  if (error) return { ok: false, error: "Couldn't unshare those contacts." };
  revalidatePath("/households");
  return { ok: true, count: data?.length ?? 0 };
}
