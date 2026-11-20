import "server-only";
import { cache } from "react";
import { todayIso } from "@/lib/format";
import { whatsappTemplateState } from "@/lib/whatsapp-template";
import { normalizeAccountStatus } from "@/lib/constants";
import { cookies } from "next/headers";
import { SUMMER_COOKIE } from "@/lib/summer";
import { parseSummerMode, summerVisible } from "@/lib/contact-tags";
import { present } from "@/lib/present";
import { applyPreview, readPreview, readSandbox } from "@/lib/preview";
import { loadDemo } from "@/lib/store";
import { createClient, isSupabaseMode } from "@/lib/supabase/server";
import { loadSupabase } from "@/lib/supabase/load";
import type { RolePerms } from "@/lib/role-permissions";
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
  const permRes = await supabase.from("role_permissions").select("role, permission, enabled").eq("org_id", profile.org_id);
  const rolePerms: RolePerms = {};
  for (const row of permRes.error ? [] : (permRes.data ?? [])) {
    if (row.role !== "shliach" && row.role !== "bochur") continue;
    (rolePerms[row.role as "shliach" | "bochur"] ??= {})[String(row.permission)] = Boolean(row.enabled);
  }
  return {
    rolePerms,
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
    themeMatchPhoto: Boolean(profile.theme_match_photo),
    themeColors: (profile.theme_colors as Record<string, unknown> | null) ?? null,
    sidebarOrder: Array.isArray(profile.sidebar_order)
      ? (profile.sidebar_order as unknown[]).filter((item): item is string => typeof item === "string")
      : null,
    shareNewWithBochurim: Boolean(profile.share_new_with_bochurim),
    bochurimEditPlanner: Boolean(profile.bochurim_edit_planner),
    bochurimSeePlannerDefault: profile.bochurim_see_planner_default !== false,
    projectId: profile.project_id ?? null,
    tutorialStep: Number(profile.tutorial_step ?? 0) || 0,
    tutorialDone: Boolean(profile.tutorial_done),
    chavrusa: profile.chavrusa === "A" || profile.chavrusa === "B" ? profile.chavrusa : null,
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

export const getAppDataAll = cache(async (): Promise<AppData | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await loadDatabase();
  const found = db.users.find((member) => member.id === user.id);
  const full = found ?? user;
  const preview = await readPreview();
  const sandbox = await readSandbox();
  const effective = applyPreview({ ...full, rolePerms: user.rolePerms }, preview);
  const data = present(db, effective, isSupabaseMode() ? "supabase" : "demo", todayIso());
  if (user.role === "admin") data.rolePermissions = user.rolePerms ?? {};
  if (data.mailSetup?.whatsappApiSendingEnabled) {
    const tpl = await whatsappTemplateState();
    data.mailSetup = {
      ...data.mailSetup,
      whatsappTemplateStatus: tpl.status,
      whatsappTemplateBody: tpl.body,
      whatsappTemplateName: tpl.name,
      whatsappTemplateSid: tpl.sid,
      whatsappTemplates: tpl.templates,
    };
  }
  const flags = {
    ...(preview && user.role === "admin" ? { preview: { role: preview.role, state: preview.state ?? null } } : {}),
    ...(sandbox ? { sandbox: true } : {}),
  };
  if (Object.keys(flags).length) {
    return { ...data, viewer: { ...data.viewer, ...flags } };
  }
  return data;
});

/** App data with the global Summer homes toggle applied (cookie). Server actions use getAppDataAll so edits never miss a contact. */
export const getAppData = cache(async (): Promise<AppData | null> => {
  const data = await getAppDataAll();
  if (!data) return data;
  const mode = parseSummerMode((await cookies()).get(SUMMER_COOKIE)?.value);
  if (mode === "all") return data;
  const keep = new Set(data.households.filter((house) => summerVisible(house.tags, mode)).map((house) => house.id));
  const households = data.households.filter((house) => keep.has(house.id));
  return {
    ...data,
    households,
    visits: data.visits.filter((visit) => keep.has(visit.householdId)),
    routes: data.routes.map((route) => ({ ...route, stops: route.stops.filter((stop) => keep.has(stop.householdId)) })),
    preplannerEntries: data.preplannerEntries.filter((entry) => keep.has(entry.householdId)),
    contactedFacts: data.contactedFacts.filter((fact) => keep.has(fact.householdId)),
    messageThreads: data.messageThreads.filter((thread) => !thread.householdId || keep.has(thread.householdId)),
    stats: { ...data.stats, householdCount: households.length },
  };
});
