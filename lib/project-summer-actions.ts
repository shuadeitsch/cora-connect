"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { readPreview } from "@/lib/preview";
import { createClient } from "@/lib/supabase/server";
import { summerStateCode } from "@/lib/summer-default";

type Result = { ok: true } | { ok: false; error: string };
type Loose = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Admins set (include / exclude) or clear a project's summer-home default for one state. RLS enforces it again. */
export async function setProjectSummerDefaultAction(input: { projectId: string; state: string; value: "include" | "exclude" | "clear" }): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (user.role !== "admin" || (await readPreview())) return { ok: false, error: "Only admins can change this." };
  const state = summerStateCode(input.state);
  if (!input.projectId || !state) return { ok: false, error: "Pick a project and a state." };
  const db = (await createClient()) as unknown as Loose;
  const { error } = input.value === "clear"
    ? await db.from("project_state_settings").delete().eq("project_id", input.projectId).eq("state", state)
    : await db.from("project_state_settings").upsert({ project_id: input.projectId, state, org_id: user.orgId, include_summer_homes: input.value === "include", updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "Couldn't save that setting." };
  revalidatePath("/", "layout");
  return { ok: true };
}
