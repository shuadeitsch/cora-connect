"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { assertNotPreview } from "@/lib/preview";
import { createClient } from "@/lib/supabase/server";
import { roleAllows } from "@/lib/role-permissions";
import type { User } from "@/lib/types";
import type { PreplannerTask, PreplannerTaskInput } from "@/lib/preplanner-tasks";

type Result = { ok: true } | { ok: false; error: string };
type Loose = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function gate(): Promise<{ ok: false; error: string } | { ok: true; user: User }> {
  const preview = await assertNotPreview();
  if (!preview.ok) return { ok: false, error: preview.error ?? "Not allowed." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (!roleAllows(user.rolePerms, user.role, "preplanner")) return { ok: false, error: "The Pre-planner is turned off for your role." };
  return { ok: true, user };
}

/** Tasks the signed-in user may see. Row-level security limits them by state, like contacts. */
export async function loadPreplannerTasks(): Promise<PreplannerTask[]> {
  const user = await getCurrentUser();
  if (!user || !roleAllows(user.rolePerms, user.role, "preplanner")) return [];
  const db = (await createClient()) as unknown as Loose;
  const { data, error } = await db.from("preplanner_tasks").select("*").order("next_follow_up", { ascending: true, nullsFirst: false }).limit(1000);
  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    state: String(row.state ?? ""),
    task: String(row.task ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    holding: String(row.holding ?? ""),
    nextFollowUp: row.next_follow_up ? String(row.next_follow_up).slice(0, 10) : null,
    done: Boolean(row.done),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function savePreplannerTaskAction(input: PreplannerTaskInput): Promise<Result> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const task = input.task.trim();
  if (!task) return { ok: false, error: "Write the task first." };
  const date = input.nextFollowUp && /^\d{4}-\d{2}-\d{2}$/.test(input.nextFollowUp) ? input.nextFollowUp : null;
  const row = {
    state: input.state.trim().slice(0, 60),
    task: task.slice(0, 2000),
    phone: input.phone.trim().slice(0, 40),
    email: input.email.trim().slice(0, 200),
    holding: input.holding.trim().slice(0, 1000),
    next_follow_up: date,
    updated_at: new Date().toISOString(),
    ...(typeof input.done === "boolean" ? { done: input.done } : {}),
  };
  const db = (await createClient()) as unknown as Loose;
  if (input.id) {
    const { data, error } = await db.from("preplanner_tasks").update(row).eq("id", input.id).select("id");
    if (error) return { ok: false, error: "Couldn't save the task." };
    if (!data?.length) return { ok: false, error: "You can't change that task." };
  } else {
    const { error } = await db.from("preplanner_tasks").insert({ ...row, org_id: g.user.orgId, created_by: g.user.id });
    if (error) return { ok: false, error: "Couldn't save the task. Check the state is one you cover." };
  }
  revalidatePath("/pre-planner");
  return { ok: true };
}

export async function setPreplannerTaskDoneAction(id: string, done: boolean): Promise<Result> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const db = (await createClient()) as unknown as Loose;
  const { data, error } = await db.from("preplanner_tasks").update({ done, updated_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Couldn't update the task." };
  revalidatePath("/pre-planner");
  return { ok: true };
}

export async function deletePreplannerTaskAction(id: string): Promise<Result> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const db = (await createClient()) as unknown as Loose;
  const { data, error } = await db.from("preplanner_tasks").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Couldn't delete the task." };
  revalidatePath("/pre-planner");
  return { ok: true };
}
