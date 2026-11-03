import type { Database } from "../lib/types";

function q(value: string | null | undefined): string {
  if (value == null) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function num(value: number | null): string {
  return value == null ? "null" : String(value);
}

function textArray(values: string[]): string {
  if (!values.length) return `array[]::text[]`;
  return `array[${values.map((value) => q(value)).join(", ")}]::text[]`;
}

function jsonb(value: Record<string, string>): string {
  return `${q(JSON.stringify(value))}::jsonb`;
}

export function toSql(db: Database): string {
  const org = db.organization;
  const lines: string[] = [
    "-- Optional fictional households for Cora. Nothing here is a real person.",
    "-- Run supabase/migrations/001_init.sql first. This does not create logins",
    "-- and does not touch admin_emails or profiles.",
    "-- Re-running deletes households, routes, and notifications on the Cora organization.",
    "begin;",
    `delete from public.routes where org_id = ${q(org.id)};`,
    `delete from public.households where org_id = ${q(org.id)};`,
    `delete from public.notifications where org_id = ${q(org.id)};`,
  ];

  for (const household of db.households) {
    lines.push(
      `insert into public.households (id, org_id, name, street, city, state, zip, country, lat, lng, notes, project_id, schedule_category_id, tags, custom_fields, created_at) values (${[
        q(household.id),
        q(household.orgId),
        q(household.name),
        q(household.street),
        q(household.city),
        q(household.state),
        q(household.zip),
        q(household.country),
        num(household.lat),
        num(household.lng),
        q(household.notes),
        q(household.projectId),
        q(household.scheduleCategoryId),
        textArray(household.tags),
        jsonb(household.customFields),
        q(household.createdAt),
      ].join(", ")});`,
    );
  }
  for (const person of db.people) {
    lines.push(
      `insert into public.people (id, household_id, name, gender, phone, email, whatsapp, sort_order) values (${q(person.id)}, ${q(person.householdId)}, ${q(person.name)}, ${person.gender ? `${q(person.gender)}::public.gender` : "null"}, ${q(person.phone)}, ${q(person.email)}, ${q(person.whatsapp)}, ${person.sortOrder});`,
    );
  }
  for (const household of db.households) {
    for (const categoryId of household.categoryIds) {
      lines.push(
        `insert into public.household_categories (household_id, category_id) values (${q(household.id)}, ${q(categoryId)});`,
      );
    }
  }
  for (const visit of db.visits) {
    lines.push(
      `insert into public.visits (id, org_id, household_id, visitor_id, visitor_name, visit_date, status, reaction, details, follow_up_date, created_at) values (${[
        q(visit.id),
        q(visit.orgId),
        q(visit.householdId),
        "null",
        q(visit.visitorName),
        `${q(visit.visitDate)}::date`,
        `${q(visit.status)}::public.visit_status`,
        visit.reaction ? `${q(visit.reaction)}::public.reaction` : "null",
        q(visit.details),
        visit.followUpDate ? `${q(visit.followUpDate)}::date` : "null",
        q(visit.createdAt),
      ].join(", ")});`,
    );
  }
  for (const route of db.routes) {
    lines.push(
      `insert into public.routes (id, org_id, name, project_id, optimized, created_by, created_at) values (${q(route.id)}, ${q(route.orgId)}, ${q(route.name)}, ${q(route.projectId)}, ${route.optimized ? "true" : "false"}, null, ${q(route.createdAt)});`,
    );
    for (const stop of route.stops) {
      lines.push(
        `insert into public.route_stops (route_id, household_id, position) values (${q(route.id)}, ${q(stop.householdId)}, ${stop.position});`,
      );
    }
  }
  for (const note of db.notifications) {
    lines.push(
      `insert into public.notifications (id, org_id, title, body, created_at) values (${q(note.id)}, ${q(note.orgId)}, ${q(note.title)}, ${q(note.body)}, ${q(note.createdAt)});`,
    );
  }
  lines.push("commit;");
  return lines.join("\n") + "\n";
}
