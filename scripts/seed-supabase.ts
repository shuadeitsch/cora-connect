import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, DEMO_USERS } from "../lib/demo-accounts";
import { SEED_ORG_ID, buildSeed } from "../lib/seed";
import type { Database, User } from "../lib/types";

// Optional fictional Auth users. Do not run this against the live project:
// it replaces the organization and creates sample logins such as Levi Cohen.
// Live household samples belong in supabase/seed_demo.sql, which creates no logins.
if (process.env.ALLOW_DEMO_AUTH_SEED !== "1") {
  console.error("Refusing to seed demo logins. Set ALLOW_DEMO_AUTH_SEED=1 only on a throwaway project.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!process.argv.includes("--yes")) {
  console.error("This replaces the demo organization in Supabase. Re-run with --yes.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const password = process.env.SEED_PASSWORD || DEMO_PASSWORD;

async function must<T>(result: { data: T; error: { message: string } | null }, label: string): Promise<T> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function authIdByEmail(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const account of DEMO_USERS) {
    const created = await supabase.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { name: account.name },
      app_metadata: { seed: true },
    });
    if (created.data.user) {
      map.set(account.email.toLowerCase(), created.data.user.id);
      continue;
    }
    const message = created.error?.message ?? "";
    if (!/already|registered|exists/i.test(message)) {
      throw new Error(`Create ${account.email}: ${message}`);
    }
    let page = 1;
    let found = "";
    while (!found) {
      const listed = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (listed.error) throw new Error(listed.error.message);
      const match = listed.data.users.find((user) => user.email?.toLowerCase() === account.email.toLowerCase());
      if (match) found = match.id;
      if (!listed.data.users.length || listed.data.users.length < 200) break;
      page += 1;
    }
    if (!found) throw new Error(`Could not find auth user for ${account.email}`);
    const updated = await supabase.auth.admin.updateUserById(found, {
      password,
      email_confirm: true,
      app_metadata: { seed: true },
      user_metadata: { name: account.name },
    });
    if (updated.error) throw new Error(updated.error.message);
    map.set(account.email.toLowerCase(), found);
  }
  return map;
}

function remapUser(user: User, ids: Map<string, string>): string {
  return ids.get(user.email.toLowerCase()) ?? user.id;
}

async function main() {
  const ids = await authIdByEmail();
  const db: Database = buildSeed(new Date());
  await must(await supabase.from("organizations").delete().eq("id", SEED_ORG_ID), "delete demo org");

  const org = db.organization;
  await must(
    await supabase.from("organizations").insert({
      id: org.id,
      name: org.name,
      chabad_house_name: org.chabadHouseName,
      street: org.street,
      city: org.city,
      state: org.state,
      zip: org.zip,
      country: org.country,
      lat: org.lat,
      lng: org.lng,
      start_lat: org.startLat,
      start_lng: org.startLng,
      default_state: org.defaultState,
      plan_name: org.planName,
      plan_limit: org.planLimit,
      plan_renews_on: org.planRenewsOn,
    }),
    "organization",
  );

  await must(
    await supabase.from("profiles").insert(
      db.users.map((user) => ({
        id: remapUser(user, ids),
        org_id: user.orgId,
        name: user.name,
        email: user.email,
        role: user.role,
        status: "approved",
        expires_at: user.expiresAt,
        can_view_history: user.canViewHistory,
        can_view_contact: user.canViewContact,
        can_edit: user.canEdit,
      })),
    ),
    "profiles",
  );

  await must(
    await supabase.from("projects").insert(db.projects.map((project) => ({ id: project.id, org_id: project.orgId, name: project.name }))),
    "projects",
  );
  await must(
    await supabase.from("categories").insert(
      db.categories.map((category) => ({
        id: category.id,
        org_id: category.orgId,
        name: category.name,
        kind: category.kind,
        interval_days: category.intervalDays,
      })),
    ),
    "categories",
  );
  await must(
    await supabase.from("custom_field_defs").insert(
      db.customFields.map((field) => ({
        id: field.id,
        org_id: field.orgId,
        name: field.name,
        field_type: field.fieldType,
        options: field.options,
      })),
    ),
    "fields",
  );
  await must(
    await supabase.from("households").insert(
      db.households.map((household) => ({
        id: household.id,
        org_id: household.orgId,
        name: household.name,
        street: household.street,
        city: household.city,
        state: household.state,
        zip: household.zip,
        country: household.country,
        lat: household.lat,
        lng: household.lng,
        notes: household.notes,
        project_id: household.projectId,
        schedule_category_id: household.scheduleCategoryId,
        tags: household.tags,
        custom_fields: household.customFields,
        created_at: household.createdAt,
      })),
    ),
    "households",
  );
  await must(
    await supabase.from("people").insert(
      db.people.map((person) => ({
        id: person.id,
        household_id: person.householdId,
        name: person.name,
        gender: person.gender,
        phone: person.phone,
        email: person.email,
        whatsapp: person.whatsapp,
        sort_order: person.sortOrder,
      })),
    ),
    "people",
  );
  const links = db.households.flatMap((household) =>
    household.categoryIds.map((categoryId) => ({ household_id: household.id, category_id: categoryId })),
  );
  await must(await supabase.from("household_categories").insert(links), "categories link");
  await must(
    await supabase.from("visits").insert(
      db.visits.map((visit) => ({
        id: visit.id,
        org_id: visit.orgId,
        household_id: visit.householdId,
        visitor_id: visit.visitorId ? ids.get(db.users.find((user) => user.id === visit.visitorId)?.email.toLowerCase() ?? "") ?? null : null,
        visitor_name: visit.visitorName,
        visit_date: visit.visitDate,
        status: visit.status,
        reaction: visit.reaction,
        details: visit.details,
        follow_up_date: visit.followUpDate,
        created_at: visit.createdAt,
      })),
    ),
    "visits",
  );
  await must(
    await supabase.from("routes").insert(
      db.routes.map((route) => ({
        id: route.id,
        org_id: route.orgId,
        name: route.name,
        project_id: route.projectId,
        optimized: route.optimized,
        created_by: route.createdBy ? ids.get(db.users.find((user) => user.id === route.createdBy)?.email.toLowerCase() ?? "") ?? null : null,
        created_at: route.createdAt,
      })),
    ),
    "routes",
  );
  await must(
    await supabase.from("route_stops").insert(
      db.routes.flatMap((route) =>
        route.stops.map((stop) => ({ route_id: route.id, household_id: stop.householdId, position: stop.position })),
      ),
    ),
    "stops",
  );
  const assignments = db.users.flatMap((user) =>
    user.assignedRouteIds.map((routeId) => ({ route_id: routeId, user_id: remapUser(user, ids) })),
  );
  if (assignments.length) await must(await supabase.from("route_assignments").insert(assignments), "assignments");
  await must(
    await supabase.from("notifications").insert(
      db.notifications.map((note) => ({
        id: note.id,
        org_id: note.orgId,
        title: note.title,
        body: note.body,
        created_at: note.createdAt,
      })),
    ),
    "notifications",
  );
  console.log(`Seeded ${db.households.length} fictional households. Demo password: ${password}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
