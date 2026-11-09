import "server-only";
import { cache } from "react";
import { todayIso } from "@/lib/format";
import { normalizeAccountStatus } from "@/lib/constants";
import { present } from "@/lib/present";
import { applyPreview, readPreview } from "@/lib/preview";
import { loadDemo } from "@/lib/store";
import { createClient, isSupabaseMode } from "@/lib/supabase/server";
import { loadSupabase } from "@/lib/supabase/load";
import type { AppData, Database, User } from "@/lib/types";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseMode()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();
  if (error || !profile) return null;
  const { data: links } = await supabase
    .from("route_assignments")
    .select("route_id")
    .eq("user_id", data.user.id);
  const territoryRes = await supabase.from("territories").select("state, area").eq("user_id", data.user.id);
  const territory = territoryRes.error
    ? []
    : (territoryRes.data ?? []).map((row) => ({ state: row.state ?? "", area: row.area ?? "" }));
  return {
    id: profile.id,
    orgId: profile.org_id,
    name: profile.name,
    email: profile.email,
    passwordHash: "",
    role: profile.role,
    status: normalizeAccountStatus(profile.status),
    expiresAt: profile.expires_at,
    canViewHistory: profile.can_view_history,
    canViewContact: profile.can_view_contact,
    canEdit: profile.can_edit,
    assignedRouteIds: (links ?? []).map((link) => link.route_id),
    leaderId: profile.leader_id ?? null,
    territory,
    avatarUrl: profile.avatar_url ?? null,
    theme: profile.theme ?? null,
    backgroundUrl: profile.background_url ?? null,
    shareNewWithBochurim: Boolean(profile.share_new_with_bochurim),
    bochurimEditPlanner: Boolean(profile.bochurim_edit_planner),
    bochurimSeePlannerDefault: profile.bochurim_see_planner_default !== false,
    projectId: profile.project_id ?? null,
  };
});

export const loadDatabase = cache(async (): Promise<Database> => {
  if (isSupabaseMode()) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in before loading household data.");
    return loadSupabase(user);
  }
  return loadDemo();
});

export const getAppData = cache(async (): Promise<AppData | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await loadDatabase();
  const found = db.users.find((member) => member.id === user.id);
  const full = found ?? user;
  const preview = await readPreview();
  const effective = applyPreview(full, preview);
  const data = present(db, effective, isSupabaseMode() ? "supabase" : "demo", todayIso());
  if (preview && user.role === "admin") {
    return {
      ...data,
      viewer: {
        ...data.viewer,
        preview: { role: preview.role, state: preview.state ?? null },
      },
    };
  }
  return data;
});
