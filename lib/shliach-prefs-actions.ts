"use server";

import { revalidatePath } from "next/cache";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { markShliachHidden } from "@/lib/supabase/write";
import type { ActionResult } from "@/lib/types";

export async function saveShliachPrefsAction(input: {
  shareNewWithBochurim?: boolean;
  bochurimEditPlanner?: boolean;
  bochurimSeePlannerDefault?: boolean;
}): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (user.role !== "shliach" && user.role !== "admin") return { ok: false, error: "Only a shliach can change these." };
  const supabase = await createClient();
  const patch: Record<string, boolean> = {};
  if (typeof input.shareNewWithBochurim === "boolean") patch.share_new_with_bochurim = input.shareNewWithBochurim;
  if (typeof input.bochurimEditPlanner === "boolean") patch.bochurim_edit_planner = input.bochurimEditPlanner;
  if (typeof input.bochurimSeePlannerDefault === "boolean") patch.bochurim_see_planner_default = input.bochurimSeePlannerDefault;
  if (!Object.keys(patch).length) return { ok: true };
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  // Keep the planner in sync: toggling see/edit defaults also sets every existing day.
  if (typeof input.bochurimSeePlannerDefault === "boolean") {
    const { error: daysError } = await supabase
      .from("planner_days")
      .update({ visible_to_bochurim: input.bochurimSeePlannerDefault })
      .eq("org_id", user.orgId);
    if (daysError) return { ok: false, error: daysError.message };
  }
  if (typeof input.bochurimEditPlanner === "boolean") {
    const { error: daysError } = await supabase
      .from("planner_days")
      .update({ editable_by_bochurim: input.bochurimEditPlanner })
      .eq("org_id", user.orgId);
    if (daysError) return { ok: false, error: daysError.message };
  }
  revalidatePath("/", "layout");
  revalidatePath("/planner");
  revalidatePath("/settings");
  return { ok: true };
}

export async function shareContactWithBochurimAction(householdId: string, share: boolean): Promise<ActionResult<{ count: number }>> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (user.role !== "shliach" && user.role !== "admin") return { ok: false, error: "Only a shliach can share with bochurim." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_contact_with_all_bochurim", { p_household: householdId, p_share: share });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: { count: Number(data ?? 0) } };
}

export async function restoreShliachHiddenAction(ids: string[]): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Admins only." };
  await markShliachHidden(ids, false);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setBochurProjectAction(bochurId: string, projectId: string): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (user.role !== "admin" && user.role !== "shliach") return { ok: false, error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ project_id: projectId || null }).eq("id", bochurId).eq("role", "bochur");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/team");
  return { ok: true };
}
