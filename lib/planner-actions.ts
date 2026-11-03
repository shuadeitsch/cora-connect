"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { createClient, isSupabaseMode } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function admin(): Promise<{ orgId: string; id: string } | string> {
  const user = await getCurrentUser();
  if (!user) return "Sign in again.";
  if (user.role !== "admin") return "Only a Cora Connect admin can change the planner.";
  if (!isSupabaseMode()) return "The planner needs the live database.";
  return { orgId: user.orgId, id: user.id };
}

function fail(message: string | undefined, fallback: string): Result {
  if (message && /duplicate key|unique/i.test(message)) return { ok: false, error: "That day is already in the planner." };
  if (message && /row-level security|permission denied/i.test(message)) return { ok: false, error: "Your account isn't allowed to change the planner." };
  return { ok: false, error: fallback };
}

function done(): Result {
  revalidatePath("/planner");
  return { ok: true };
}

export async function addPlannerDayAction(date: string): Promise<Result> {
  const who = await admin();
  if (typeof who === "string") return { ok: false, error: who };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a date." };
  const supabase = await createClient();
  const { error } = await supabase.from("planner_days").insert({ org_id: who.orgId, date, created_by: who.id });
  return error ? fail(error.message, "Couldn't add the day.") : done();
}

export async function removePlannerDayAction(id: string): Promise<Result> {
  const who = await admin();
  if (typeof who === "string") return { ok: false, error: who };
  const supabase = await createClient();
  const { error } = await supabase.from("planner_days").delete().eq("id", id);
  return error ? fail(error.message, "Couldn't remove the day.") : done();
}

export async function addPlannerItemAction(input: {
  dayId: string;
  kind: "route" | "event";
  routeId?: string;
  title: string;
  time?: string;
  notes?: string;
  address?: string;
}): Promise<Result> {
  const who = await admin();
  if (typeof who === "string") return { ok: false, error: who };
  const title = input.title.trim().slice(0, 200);
  if (input.kind === "route" && !input.routeId) return { ok: false, error: "Pick a route." };
  if (input.kind === "event" && !title) return { ok: false, error: "Give the event a title." };
  const time = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time : null;
  const supabase = await createClient();
  const { error } = await supabase.from("planner_items").insert({
    org_id: who.orgId,
    day_id: input.dayId,
    kind: input.kind,
    route_id: input.kind === "route" ? input.routeId : null,
    title,
    time,
    notes: (input.notes ?? "").trim().slice(0, 2000),
    address: input.kind === "event" ? (input.address ?? "").trim().slice(0, 300) : "",
    sort: Date.now() % 2147483647,
    created_by: who.id,
  });
  return error ? fail(error.message, "Couldn't add it to the day.") : done();
}

export async function removePlannerItemAction(id: string): Promise<Result> {
  const who = await admin();
  if (typeof who === "string") return { ok: false, error: who };
  const supabase = await createClient();
  const { error } = await supabase.from("planner_items").delete().eq("id", id);
  return error ? fail(error.message, "Couldn't remove it.") : done();
}
