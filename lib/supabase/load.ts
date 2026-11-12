import "server-only";
import { normalizeAccountStatus, parseHouseholdReaction } from "@/lib/constants";
import { parseVisitStatus } from "@/lib/visit-status";
import type {
  AppNotification,
  Category,
  CategoryKind,
  ContactVisit,
  CustomFieldDef,
  Database,
  FieldType,
  Gender,
  Household,
  HouseholdReaction,
  Invite,
  Person,
  Project,
  Reaction,
  Role,
  Route,
  User,
  Visit,
  VisitStatus,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { parseExtraAddresses } from "@/lib/extra-addresses";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (value == null || value === "") return null;
  return String(value);
}

function num(row: Row, key: string): number | null {
  const value = row[key];
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

async function paged(table: string, columns = "*", order: string | string[] = "id"): Promise<{ rows: Row[]; error: string }> {
  const supabase = await createClient();
  const pageSize = 1000;
  const orders = Array.isArray(order) ? order : [order];
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(columns);
    for (const column of orders) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) return { rows, error: error.message };
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    if (from >= pageSize * 100) throw new Error(`${table}: stopped after ${rows.length} rows`);
  }
  return { rows, error: "" };
}

async function optionalTable(table: string): Promise<{ rows: Row[]; ready: boolean }> {
  const loaded = await paged(table);
  if (!loaded.error) return { rows: loaded.rows, ready: true };
  if (/does not exist|schema cache|could not find the table/i.test(loaded.error)) return { rows: [], ready: false };
  throw new Error(`${table}: ${loaded.error}`);
}

function alive(row: Row) {
  return nullableText(row, "deleted_at") == null;
}

/** Live rows only. Prefer a server-side deleted_at filter so a missing column in the
 *  payload cannot leak soft-deleted households into the app (that produced the 443 count). */
async function aliveRows(table: string, columns = "*", order: string | string[] = "id"): Promise<Row[]> {
  const supabase = await createClient();
  const pageSize = 1000;
  const orders = Array.isArray(order) ? order : [order];
  const out: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(columns).is("deleted_at", null);
    for (const column of orders) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data ?? []) as unknown as Row[];
    out.push(...batch);
    if (batch.length < pageSize) break;
    if (from >= pageSize * 100) throw new Error(`${table}: stopped after ${out.length} rows`);
  }
  return out;
}

async function rows(table: string, columns = "*", order: string | string[] = "id"): Promise<Row[]> {
  const loaded = await paged(table, columns, order);
  if (loaded.error) throw new Error(`${table}: ${loaded.error}`);
  return loaded.rows;
}

export async function loadSupabase(actor: User): Promise<Database> {
  const supabase = await createClient();
  const orgRes = await supabase.from("organizations").select("*").eq("id", actor.orgId).maybeSingle();
  if (orgRes.error) throw new Error(`organizations: ${orgRes.error.message}`);
  if (!orgRes.data) throw new Error("No organization is attached to this account yet.");
  const org = orgRes.data as unknown as Row;

  const contactVisitLoad = await optionalTable("contact_visits");
  const shareLoad = await optionalTable("contact_shares");
  const pairLoad = await supabase.from("not_duplicate_pairs").select("a_id, b_id");
  const notDuplicatePairs = pairLoad.error ? [] : ((pairLoad.data ?? []) as { a_id: string; b_id: string }[]).map((row) => `${row.a_id}|${row.b_id}`);
  const [profiles, projects, categories, fields, householdRows, peopleRows, categoryLinks, visitRows, routeRows, stopRows, assignmentRows, notifications, reads] =
    await Promise.all([
      rows("profiles"),
      rows("projects"),
      rows("categories"),
      rows("custom_field_defs"),
      aliveRows("households"),
      rows("people_visible"),
      rows("household_categories", "*", ["household_id", "category_id"]),
      rows("visits_visible"),
      rows("routes"),
      rows("route_stops"),
      rows("route_assignments", "*", ["route_id", "user_id"]),
      rows("notifications"),
      rows("notification_reads", "notification_id, user_id", ["notification_id", "user_id"]),
    ]);

  let inviteRows: Row[] = [];
  if (actor.role === "admin") {
    inviteRows = await rows("invites");
  }

  let territoryRows: Row[] = [];
  const territoryRes = await supabase.from("territories").select("user_id, state, area");
  if (!territoryRes.error) territoryRows = (territoryRes.data ?? []) as unknown as Row[];

  const categoriesByHousehold = new Map<string, string[]>();
  for (const link of categoryLinks) {
    const householdId = text(link, "household_id");
    const listForHouse = categoriesByHousehold.get(householdId) ?? [];
    listForHouse.push(text(link, "category_id"));
    categoriesByHousehold.set(householdId, listForHouse);
  }

  const assignmentsByUser = new Map<string, string[]>();
  for (const link of assignmentRows) {
    const userId = text(link, "user_id");
    const listForUser = assignmentsByUser.get(userId) ?? [];
    listForUser.push(text(link, "route_id"));
    assignmentsByUser.set(userId, listForUser);
  }

  const stopsByRoute = new Map<string, { householdId: string; position: number }[]>();
  for (const stop of stopRows) {
    const routeId = text(stop, "route_id");
    const listForRoute = stopsByRoute.get(routeId) ?? [];
    listForRoute.push({ householdId: text(stop, "household_id"), position: Number(stop.position ?? 0) });
    stopsByRoute.set(routeId, listForRoute);
  }

  const readsByNote = new Map<string, string[]>();
  for (const read of reads) {
    const id = text(read, "notification_id");
    const listForNote = readsByNote.get(id) ?? [];
    listForNote.push(text(read, "user_id"));
    readsByNote.set(id, listForNote);
  }

  const territoryByUser = new Map<string, { state: string; area: string }[]>();
  for (const row of territoryRows) {
    const userId = text(row, "user_id");
    const listForUser = territoryByUser.get(userId) ?? [];
    listForUser.push({ state: text(row, "state"), area: text(row, "area") });
    territoryByUser.set(userId, listForUser);
  }

  const users: User[] = profiles.map((profile) => ({
    id: text(profile, "id"),
    orgId: text(profile, "org_id"),
    name: text(profile, "name"),
    email: text(profile, "email"),
    passwordHash: "",
    role: text(profile, "role") as Role,
    status: normalizeAccountStatus(text(profile, "status")),
    expiresAt: nullableText(profile, "expires_at"),
    canViewHistory: Boolean(profile.can_view_history),
    canViewContact: Boolean(profile.can_view_contact),
    canEdit: Boolean(profile.can_edit),
    assignedRouteIds: assignmentsByUser.get(text(profile, "id")) ?? [],
    leaderId: nullableText(profile, "leader_id"),
    avatarUrl: nullableText(profile, "avatar_url"),
    backgroundUrl: nullableText(profile, "background_url"),
    themeMatchPhoto: Boolean(profile.theme_match_photo),
    themeColors: (profile.theme_colors as Record<string, unknown> | null) ?? null,
    theme: nullableText(profile, "theme"),
    shareNewWithBochurim: Boolean(profile.share_new_with_bochurim),
    bochurimEditPlanner: Boolean(profile.bochurim_edit_planner),
    bochurimSeePlannerDefault: profile.bochurim_see_planner_default !== false,
    projectId: nullableText(profile, "project_id"),
    tutorialStep: Number(profile.tutorial_step ?? 0) || 0,
    tutorialDone: Boolean(profile.tutorial_done),
    chavrusa: profile.chavrusa === "A" || profile.chavrusa === "B" ? profile.chavrusa : null,
    adminApprovedAt: nullableText(profile, "admin_approved_at"),
    finalApprovedAt: nullableText(profile, "final_approved_at"),
    territory: territoryByUser.get(text(profile, "id")) ?? [],
  }));

  const households: Household[] = householdRows.filter(alive).map((row) => ({
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    name: text(row, "name"),
    street: text(row, "street"),
    city: text(row, "city"),
    state: text(row, "state"),
    zip: text(row, "zip"),
    country: text(row, "country") || "USA",
    lat: num(row, "lat"),
    lng: num(row, "lng"),
    extraAddresses: parseExtraAddresses(row.extra_addresses),
    notes: text(row, "notes"),
    projectId: nullableText(row, "project_id"),
    scheduleCategoryId: nullableText(row, "schedule_category_id"),
    categoryIds: categoriesByHousehold.get(text(row, "id")) ?? [],
    tags: list(row.tags),
    sharedWithCora: row.shared_with_cora == null ? true : Boolean(row.shared_with_cora),
    ownerId: nullableText(row, "owner_id"),
    deletedAt: nullableText(row, "deleted_at"),
    deletedByShliachAt: nullableText(row, "deleted_by_shliach_at"),
    deletedByShliachBy: nullableText(row, "deleted_by_shliach_by"),
    visitReaction: parseHouseholdReaction(text(row, "visit_reaction")),
    possibleDuplicate: Boolean(row.possible_duplicate),
    duplicateOf: nullableText(row, "duplicate_of"),
    importBatchId: nullableText(row, "import_batch_id"),
    createdBy: nullableText(row, "created_by"),
    customFields:
      row.custom_fields && typeof row.custom_fields === "object"
        ? Object.fromEntries(Object.entries(row.custom_fields as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]))
        : {},
    createdAt: text(row, "created_at"),
  }));

  const people: Person[] = peopleRows.map((row) => ({
    id: text(row, "id"),
    householdId: text(row, "household_id"),
    name: text(row, "name"),
    gender: (nullableText(row, "gender") as Gender | null) ?? null,
    phone: text(row, "phone"),
    phone2: text(row, "phone2"),
    phone3: text(row, "phone3"),
    email: text(row, "email"),
    whatsapp: text(row, "whatsapp"),
    sortOrder: Number(row.sort_order ?? 0),
  }));

  const visits: Visit[] = visitRows.filter(alive).map((row) => ({
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    householdId: text(row, "household_id"),
    visitorId: nullableText(row, "visitor_id"),
    visitorName: text(row, "visitor_name"),
    visitDate: text(row, "visit_date").slice(0, 10),
    status: (nullableText(row, "status") as VisitStatus | null) ?? null,
    reaction: (nullableText(row, "reaction") as Reaction | null) ?? null,
    details: text(row, "details"),
    followUpDate: nullableText(row, "follow_up_date")?.slice(0, 10) ?? null,
    createdAt: text(row, "created_at"),
    projectId: nullableText(row, "project_id"),
    activities: list(row.activities),
  }));

  const contactVisits: ContactVisit[] = contactVisitLoad.rows.filter(alive).map((row) => ({
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    householdId: text(row, "household_id"),
    visited: text(row, "visited"),
    visitedBy: nullableText(row, "visited_by"),
    activities: list(row.activities),
    reaction: parseHouseholdReaction(text(row, "reaction")) as HouseholdReaction | null,
    notes: text(row, "notes"),
    visitDate: nullableText(row, "visit_date")?.slice(0, 10) ?? null,
    status: text(row, "status").trim() ? parseVisitStatus(text(row, "status")).status : null,
    arrived: text(row, "arrived"),
    createdBy: nullableText(row, "created_by"),
    createdAt: text(row, "created_at"),
    importBatchId: nullableText(row, "import_batch_id"),
    projectId: nullableText(row, "project_id"),
  }));

  const routes: Route[] = routeRows.map((row) => ({
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    name: text(row, "name"),
    projectId: nullableText(row, "project_id"),
    optimized: Boolean(row.optimized),
    createdBy: nullableText(row, "created_by"),
    createdAt: text(row, "created_at"),
    stops: (stopsByRoute.get(text(row, "id")) ?? []).sort((a, b) => a.position - b.position),
  }));

  const mappedCategories: Category[] = categories.map((row) => ({
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    name: text(row, "name"),
    kind: text(row, "kind") as CategoryKind,
    intervalDays: num(row, "interval_days"),
  }));

  const mappedProjects: Project[] = projects.map((row) => ({
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    name: text(row, "name"),
  }));

  const customFields: CustomFieldDef[] = fields.map((row) => ({
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    name: text(row, "name"),
    fieldType: text(row, "field_type") as FieldType,
    options: list(row.options),
  }));

  const invites: Invite[] = inviteRows.map((row) => {
    const states = list(row.territory_states);
    const areas = list(row.territory_areas);
    const territory = states.length
      ? (areas.length
        ? states.flatMap((state) => areas.map((area) => ({ state, area })))
        : states.map((state) => ({ state, area: "" })))
      : [];
    return {
      id: text(row, "id"),
      orgId: text(row, "org_id"),
      name: text(row, "name"),
      email: text(row, "email"),
      role: text(row, "role") as Role,
      expiresAt: nullableText(row, "expires_at"),
      canViewHistory: Boolean(row.can_view_history),
      canViewContact: Boolean(row.can_view_contact),
      canEdit: Boolean(row.can_edit),
      assignedRouteIds: list(row.assigned_route_ids),
      territory,
      acceptedAt: nullableText(row, "accepted_at"),
      createdAt: text(row, "created_at"),
    };
  });

  const notes: AppNotification[] = notifications.map((row) => ({
    id: text(row, "id"),
    orgId: text(row, "org_id"),
    title: text(row, "title"),
    body: text(row, "body"),
    createdAt: text(row, "created_at"),
    readBy: readsByNote.get(text(row, "id")) ?? [],
  }));

  return {
    version: 1,
    organization: {
      id: text(org, "id"),
      name: text(org, "name"),
      chabadHouseName: text(org, "chabad_house_name"),
      street: text(org, "street"),
      city: text(org, "city"),
      state: text(org, "state"),
      zip: text(org, "zip"),
      country: text(org, "country") || "USA",
      lat: num(org, "lat"),
      lng: num(org, "lng"),
      startLat: num(org, "start_lat"),
      startLng: num(org, "start_lng"),
      defaultState: text(org, "default_state"),
      planName: text(org, "plan_name"),
      planLimit: Number(org.plan_limit ?? 1000),
      planRenewsOn: text(org, "plan_renews_on").slice(0, 10),
    },
    users,
    invites,
    projects: mappedProjects,
    categories: mappedCategories,
    customFields,
    households,
    people,
    visits,
    contactVisits,
    contactVisitsReady: contactVisitLoad.ready,
    notDuplicatePairs,
    contactShares: shareLoad.rows.map((row) => ({ householdId: text(row, "household_id"), bochurId: text(row, "bochur_id") })),
    removedVisitIds: contactVisitLoad.rows.filter((row) => !alive(row)).map((row) => text(row, "id")),
    routes,
    notifications: notes,
  };
}
