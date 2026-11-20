"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { readPreview } from "@/lib/preview";
import { createClient } from "@/lib/supabase/server";
import { ROLE_PERMISSION_DEFS, type PermissionRole } from "@/lib/role-permissions";

type Result = { ok: true } | { ok: false; error: string };
type Loose = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Admins turn one permission on or off for a role. Row-level security allows only admins to write it. */
export async function setRolePermissionAction(input: { role: PermissionRole; permission: string; enabled: boolean }): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (user.role !== "admin" || (await readPreview())) return { ok: false, error: "Only admins can change permissions." };
  if (input.role !== "shliach" && input.role !== "bochur") return { ok: false, error: "Unknown role." };
  if (!ROLE_PERMISSION_DEFS[input.role].some((def) => def.key === input.permission)) return { ok: false, error: "Unknown permission." };
  const db = (await createClient()) as unknown as Loose;
  const { error } = await db.from("role_permissions").upsert({ org_id: user.orgId, role: input.role, permission: input.permission, enabled: Boolean(input.enabled), updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "Couldn't save that setting." };
  revalidatePath("/", "layout");
  return { ok: true };
}
