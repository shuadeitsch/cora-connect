"use server";

import { assertNotPreview } from "@/lib/preview";
import { parseChavrusa, type Chavrusa } from "@/lib/chavrusa";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { createClient, isSupabaseMode } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function plannerActor(): Promise<{ orgId: string; id: string } | string> {
  const user = await getCurrentUser();
  if (!user) return "Sign in again.";
  if (!isSupabaseMode()) return "The planner needs the live database.";
  if (user.role === "admin" || user.role === "shliach") return { orgId: user.orgId, id: user.id };
  if (user.role === "bochur") {
    // RLS enforces the shliach's bochurim_edit_planner flag.
    return { orgId: user.orgId, id: user.id };
  }
  return "You can't change the planner.";
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

export async function addPlannerDayAction(date: string, chavrusa?: Chavrusa | null): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
  if (typeof who === "string") return { ok: false, error: who };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a date." };
  const supabase = await createClient();
  const user = await getCurrentUser();
  const visible = user?.role === "shliach" ? user.bochurimSeePlannerDefault !== false : true;
  const editable = user?.role === "shliach" ? Boolean(user.bochurimEditPlanner) : false;
  const { error } = await supabase.from("planner_days").insert({
    org_id: who.orgId,
    date,
    created_by: who.id,
    visible_to_bochurim: visible,
    editable_by_bochurim: editable,
    chavrusa: parseChavrusa(chavrusa),
  });
  return error ? fail(error.message, "Couldn't add the day.") : done();
}

export async function removePlannerDayAction(id: string): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
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
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
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
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
  if (typeof who === "string") return { ok: false, error: who };
  const supabase = await createClient();
  const { error } = await supabase.from("planner_items").delete().eq("id", id);
  return error ? fail(error.message, "Couldn't remove it.") : done();
}

export async function updatePlannerItemAction(input: {
  id: string;
  kind: "route" | "event";
  routeId?: string;
  title: string;
  time?: string;
  notes?: string;
  address?: string;
}): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
  if (typeof who === "string") return { ok: false, error: who };
  const title = input.title.trim().slice(0, 200);
  if (input.kind === "route" && !input.routeId) return { ok: false, error: "Pick a route." };
  if (input.kind === "event" && !title) return { ok: false, error: "Give the event a title." };
  const time = input.time && /^\d{2}:\d{2}/.test(input.time) ? input.time.slice(0, 5) : null;
  const supabase = await createClient();
  // Same id, day and sort, so the item keeps its place.
  const { data, error } = await supabase
    .from("planner_items")
    .update({
      route_id: input.kind === "route" ? input.routeId : null,
      title,
      time,
      notes: (input.notes ?? "").trim().slice(0, 2000),
      address: input.kind === "event" ? (input.address ?? "").trim().slice(0, 300) : "",
    })
    .eq("id", input.id)
    .select("id");
  if (error) return fail(error.message, "Couldn't save your changes.");
  if (!data?.length) return { ok: false, error: "Your account isn't allowed to change the planner." };
  return done();
}

/** Plan a trip: put a saved route (and any fixed-time extra stops as events) on a date, adding the day if it isn't in the planner yet. */
export async function addTripDayToPlannerAction(input: {
  date: string;
  routeId: string;
  title: string;
  time?: string;
  events?: { title: string; time?: string; address?: string }[];
  chavrusa?: Chavrusa | null;
}): Promise<{ ok: true; dayId: string; itemIds: string[] } | { ok: false; error: string }> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
  if (typeof who === "string") return { ok: false, error: who };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Pick a date." };
  const supabase = await createClient();
  const tripChavrusa = parseChavrusa(input.chavrusa);
  let dayQuery = supabase.from("planner_days").select("id").eq("date", input.date);
  dayQuery = tripChavrusa ? dayQuery.eq("chavrusa", tripChavrusa) : dayQuery.is("chavrusa", null);
  let { data: day } = await dayQuery.maybeSingle();
  if (!day) {
    const actor = await getCurrentUser();
    const visible = actor?.role === "shliach" ? actor.bochurimSeePlannerDefault !== false : true;
    const editable = actor?.role === "shliach" ? Boolean(actor.bochurimEditPlanner) : false;
    const inserted = await supabase.from("planner_days").insert({ org_id: who.orgId, date: input.date, created_by: who.id, visible_to_bochurim: visible, editable_by_bochurim: editable, chavrusa: tripChavrusa }).select("id").single();
    if (inserted.error) return fail(inserted.error.message, "Couldn't add the day.") as { ok: false; error: string };
    day = inserted.data;
  }
  const clean = (time?: string) => (time && /^\d{2}:\d{2}$/.test(time) ? time : null);
  const base = Date.now() % 2147483000;
  const rows = [
    { kind: "route", route_id: input.routeId, title: input.title.trim().slice(0, 200), time: clean(input.time), address: "" },
    ...(input.events ?? []).map((event) => ({ kind: "event", route_id: null, title: event.title.trim().slice(0, 200), time: clean(event.time), address: (event.address ?? "").trim().slice(0, 300) })),
  ].map((row, index) => ({ ...row, org_id: who.orgId, day_id: day!.id, notes: "", sort: base + index, created_by: who.id }));
  const { data, error } = await supabase.from("planner_items").insert(rows).select("id");
  if (error) return fail(error.message, "Couldn't add it to the day.") as { ok: false; error: string };
  revalidatePath("/planner");
  return { ok: true, dayId: day!.id, itemIds: (data ?? []).map((row) => row.id as string) };
}


export async function setPlannerDayVisibleAction(dayId: string, visible: boolean): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
  if (typeof who === "string") return { ok: false, error: who };
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "shliach")) return { ok: false, error: "Only a shliach or admin can change day visibility." };
  const supabase = await createClient();
  const { error } = await supabase.from("planner_days").update({ visible_to_bochurim: visible }).eq("id", dayId);
  return error ? fail(error.message, "Couldn't update day visibility.") : done();
}

/** Top-level "Bochurim can see the planner": set all days + sync Settings default. */
export async function setBochurimSeePlannerAction(visible: boolean): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "shliach")) return { ok: false, error: "Only a shliach or admin can change this." };
  const supabase = await createClient();
  const { error: daysError } = await supabase.from("planner_days").update({ visible_to_bochurim: visible }).eq("org_id", user.orgId);
  if (daysError) return fail(daysError.message, "Couldn't update planner days.");
  if (user.role === "shliach") {
    const { error: prefError } = await supabase.from("profiles").update({ bochurim_see_planner_default: visible }).eq("id", user.id);
    if (prefError) return fail(prefError.message, "Couldn't save the default preference.");
  }
  revalidatePath("/planner");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setBochurimEditPlannerAction(allowed: boolean): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "shliach")) return { ok: false, error: "Only a shliach or admin can change this." };
  const supabase = await createClient();
  const { error: daysError } = await supabase.from("planner_days").update({ editable_by_bochurim: allowed }).eq("org_id", user.orgId);
  if (daysError) return fail(daysError.message, "Couldn't update planner days.");
  if (user.role === "shliach") {
    const { error } = await supabase.from("profiles").update({ bochurim_edit_planner: allowed }).eq("id", user.id);
    if (error) return fail(error.message, "Couldn't save the edit preference.");
  }
  revalidatePath("/planner");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setPlannerDayEditableAction(dayId: string, editable: boolean): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
  if (typeof who === "string") return { ok: false, error: who };
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "shliach")) return { ok: false, error: "Only a shliach or admin can change day editing." };
  const supabase = await createClient();
  const { error } = await supabase.from("planner_days").update({ editable_by_bochurim: editable }).eq("id", dayId);
  return error ? fail(error.message, "Couldn't update day editing.") : done();
}


export async function setPlannerDayChavrusaAction(dayId: string, chavrusa: Chavrusa | null): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const who = await plannerActor();
  if (typeof who === "string") return { ok: false, error: who };
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "shliach")) {
    return { ok: false, error: "Only a shliach or admin can change which chavrusa a day belongs to." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("planner_days").update({ chavrusa: parseChavrusa(chavrusa) }).eq("id", dayId);
  if (error && /duplicate key|unique/i.test(error.message)) {
    return { ok: false, error: "That chavrusa already has this day." };
  }
  return error ? fail(error.message, "Couldn't update the day's chavrusa.") : done();
}
