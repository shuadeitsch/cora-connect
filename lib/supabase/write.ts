import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  ContactVisit,
  CustomFieldDef,
  Household,
  Invite,
  Organization,
  Person,
  Project,
  Route,
  User,
  Visit,
} from "@/lib/types";

async function done(result: { error: { message: string } | null }, label: string) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
}

function householdRow(household: Household) {
  return {
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
    shared_with_cora: household.sharedWithCora,
    owner_id: household.ownerId,
    visit_reaction: household.visitReaction,
    created_at: household.createdAt,
  };
}

export async function writeHousehold(
  household: Household,
  people: Person[],
  isNew: boolean,
  extras?: { importBatchId?: string | null; possibleDuplicate?: boolean; duplicateOf?: string | null },
) {
  const supabase = await createClient();
  const row = householdRow(household);
  const flagged = extras
    ? {
        ...row,
        ...(extras.importBatchId !== undefined ? { import_batch_id: extras.importBatchId } : {}),
        ...(extras.possibleDuplicate !== undefined ? { possible_duplicate: extras.possibleDuplicate } : {}),
        ...(extras.duplicateOf !== undefined ? { duplicate_of: extras.duplicateOf } : {}),
      }
    : row;
  // Do not chain .select(). INSERT ... RETURNING is checked by the SELECT
  // policy, and an id lookup cannot see the row being inserted.
  if (isNew) {
    let inserted = await supabase.from("households").insert(flagged);
    if (inserted.error && extras && missingColumn(inserted.error.message)) {
      inserted = await supabase.from("households").insert(row);
    }
    await done(inserted, "Save contact");
  } else {
    const { id, created_at, ...patch } = flagged;
    void id;
    void created_at;
    let updated = await supabase.from("households").update(patch).eq("id", household.id);
    if (updated.error && extras && missingColumn(updated.error.message)) {
      const plain = householdRow(household);
      const { id: plainId, created_at: created, ...plainPatch } = plain;
      void plainId;
      void created;
      updated = await supabase.from("households").update(plainPatch).eq("id", household.id);
    }
    await done(updated, "Save contact");
  }
  await done(await supabase.from("people").delete().eq("household_id", household.id), "Replace people");
  if (people.length) {
    await done(
      await supabase.from("people").insert(
        people.map((person) => ({
          id: person.id,
          household_id: person.householdId,
          name: person.name,
          gender: person.gender,
          phone: person.phone,
          email: person.email,
          whatsapp: person.phone || person.whatsapp,
          sort_order: person.sortOrder,
        })),
      ),
      "Save people",
    );
  }
  await done(
    await supabase.from("household_categories").delete().eq("household_id", household.id),
    "Replace categories",
  );
  if (household.categoryIds.length) {
    await done(
      await supabase
        .from("household_categories")
        .insert(household.categoryIds.map((categoryId) => ({ household_id: household.id, category_id: categoryId }))),
      "Save categories",
    );
  }
}

export async function removeHousehold(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("households").delete().eq("id", id), "Delete contact");
}

export async function householdExists(id: string) {
  const supabase = await createClient();
  const result = await supabase.from("households").select("id").eq("id", id).maybeSingle();
  if (result.error) return false;
  return Boolean(result.data);
}

export async function patchHousehold(
  id: string,
  patch: { schedule_category_id?: string | null; },
) {
  const supabase = await createClient();
  await done(await supabase.from("households").update(patch).eq("id", id), "Update contact");
}

export async function replaceCategories(householdId: string, categoryIds: string[]) {
  const supabase = await createClient();
  await done(
    await supabase.from("household_categories").delete().eq("household_id", householdId),
    "Clear categories",
  );
  if (categoryIds.length) {
    await done(
      await supabase
        .from("household_categories")
        .insert(categoryIds.map((categoryId) => ({ household_id: householdId, category_id: categoryId }))),
      "Save categories",
    );
  }
}

function missingColumn(message: string) {
  return /column|schema cache|could not find the/i.test(message);
}

export async function writeVisit(visit: Visit, isNew: boolean) {
  const supabase = await createClient();
  const row = {
    id: visit.id,
    org_id: visit.orgId,
    household_id: visit.householdId,
    visitor_id: visit.visitorId,
    visitor_name: visit.visitorName,
    visit_date: visit.visitDate || null,
    status: visit.status,
    reaction: visit.reaction,
    details: visit.details,
    created_at: visit.createdAt,
  };
  if (isNew) {
    await done(
      await supabase.from("visits").insert({ ...row, follow_up_date: visit.followUpDate }),
      "Save visit",
    );
    return;
  }
  const { id, created_at, ...patch } = row;
  void id;
  void created_at;
  await done(await supabase.from("visits").update(patch).eq("id", visit.id), "Save visit");
}

export async function removeVisit(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("visits").delete().eq("id", id), "Delete visit");
}

export async function softDeleteVisits(ids: string[], deleted: boolean): Promise<"soft" | "missing"> {
  if (!ids.length) return "soft";
  const supabase = await createClient();
  const result = await supabase.from("visits").update({ deleted_at: deleted ? new Date().toISOString() : null }).in("id", ids);
  if (result.error) {
    if (missingColumn(result.error.message)) return "missing";
    throw new Error(`Save visit: ${result.error.message}`);
  }
  return "soft";
}

export async function markHouseholdsDeleted(ids: string[], deleted: boolean): Promise<"soft" | "missing"> {
  if (!ids.length) return "soft";
  const supabase = await createClient();
  const result = await supabase.from("households").update({ deleted_at: deleted ? new Date().toISOString() : null }).in("id", ids);
  if (result.error) {
    if (missingColumn(result.error.message)) return "missing";
    throw new Error(`Save contact: ${result.error.message}`);
  }
  return "soft";
}

export async function writeContactVisit(visit: ContactVisit, isNew: boolean) {
  const supabase = await createClient();
  const row = {
    id: visit.id,
    org_id: visit.orgId,
    household_id: visit.householdId,
    visited: visit.visited,
    reaction: visit.reaction,
    notes: visit.notes,
    visit_date: visit.visitDate,
    status: visit.status,
    arrived: visit.arrived,
    created_by: visit.createdBy,
    created_at: visit.createdAt,
    import_batch_id: visit.importBatchId,
  };
  const write = async (payload: Record<string, unknown>) => {
    if (isNew) return supabase.from("contact_visits").insert(payload);
    const { id, created_at, ...patch } = payload;
    void id;
    void created_at;
    return supabase.from("contact_visits").update(patch).eq("id", visit.id);
  };
  let result = await write(row);
  if (result.error && missingColumn(result.error.message)) {
    const payload = { ...row } as Record<string, unknown>;
    if (/status/i.test(result.error.message)) delete payload.status;
    if (/import_batch/i.test(result.error.message)) delete payload.import_batch_id;
    if (!/status|import_batch/i.test(result.error.message)) {
      delete payload.status;
      delete payload.import_batch_id;
    }
    result = await write(payload);
  }
  await done(result, "Save visit");
}

export async function removeContactVisit(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("contact_visits").delete().eq("id", id), "Delete visit");
}

export async function undoImportRows(batchId: string, householdIds: string[], visitIds: string[]) {
  const supabase = await createClient();
  if (visitIds.length) {
    const byId = await supabase.from("contact_visits").delete().in("id", visitIds);
    if (byId.error && !/schema cache|could not find the table|does not exist/i.test(byId.error.message)) {
      throw new Error(`Undo import: ${byId.error.message}`);
    }
  }
  if (batchId) {
    const visits = await supabase.from("contact_visits").delete().eq("import_batch_id", batchId);
    if (visits.error && !missingColumn(visits.error.message) && !/schema cache|could not find the table|does not exist/i.test(visits.error.message)) {
      throw new Error(`Undo import: ${visits.error.message}`);
    }
    const homes = await supabase.from("households").delete().eq("import_batch_id", batchId);
    if (homes.error && !missingColumn(homes.error.message)) throw new Error(`Undo import: ${homes.error.message}`);
  }
  for (const id of householdIds) {
    await done(await supabase.from("households").delete().eq("id", id), "Undo import");
  }
}

export async function patchHouseholdFlags(
  id: string,
  patch: { possible_duplicate?: boolean; duplicate_of?: string | null; import_batch_id?: string | null },
) {
  const supabase = await createClient();
  const result = await supabase.from("households").update(patch).eq("id", id);
  if (result.error) {
    if (missingColumn(result.error.message)) return false;
    throw new Error(`Save contact: ${result.error.message}`);
  }
  return true;
}

export async function writeRoute(route: Route) {
  const supabase = await createClient();
  await done(
    await supabase
      .from("routes")
      .upsert({
        id: route.id,
        org_id: route.orgId,
        name: route.name,
        project_id: route.projectId,
        optimized: route.optimized,
        created_by: route.createdBy,
        created_at: route.createdAt,
      })
      .select("id")
      .single(),
    "Save route",
  );
  await done(await supabase.from("route_stops").delete().eq("route_id", route.id).select("id"), "Replace stops");
  if (route.stops.length) {
    await done(
      await supabase
        .from("route_stops")
        .insert(
          route.stops.map((stop) => ({
            route_id: route.id,
            household_id: stop.householdId,
            position: stop.position,
          })),
        )
        .select("id"),
      "Save stops",
    );
  }
}

export async function removeRoute(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("routes").delete().eq("id", id).select("id"), "Delete route");
}

export async function removeAllRoutes(orgId: string) {
  const supabase = await createClient();
  await done(await supabase.from("routes").delete().eq("org_id", orgId).select("id"), "Delete routes");
}

export async function writeOrganization(org: Organization) {
  const supabase = await createClient();
  await done(
    await supabase
      .from("organizations")
      .update({
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
        plan_renews_on: org.planRenewsOn || null,
      })
      .eq("id", org.id)
      .select("id"),
    "Save organization",
  );
}

export async function writeCategory(category: Category) {
  const supabase = await createClient();
  await done(
    await supabase
      .from("categories")
      .upsert({
        id: category.id,
        org_id: category.orgId,
        name: category.name,
        kind: category.kind,
        interval_days: category.intervalDays,
      })
      .select("id")
      .single(),
    "Save category",
  );
}

export async function removeCategory(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("categories").delete().eq("id", id).select("id"), "Delete category");
}

export async function writeProject(project: Project) {
  const supabase = await createClient();
  await done(
    await supabase.from("projects").upsert({ id: project.id, org_id: project.orgId, name: project.name }).select("id").single(),
    "Save project",
  );
}

export async function removeProject(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("projects").delete().eq("id", id).select("id"), "Delete project");
}

export async function writeField(field: CustomFieldDef) {
  const supabase = await createClient();
  await done(
    await supabase
      .from("custom_field_defs")
      .upsert({
        id: field.id,
        org_id: field.orgId,
        name: field.name,
        field_type: field.fieldType,
        options: field.options,
      })
      .select("id")
      .single(),
    "Save custom field",
  );
}

export async function removeField(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("custom_field_defs").delete().eq("id", id).select("id"), "Delete custom field");
}

export async function setProfileAccess(
  id: string,
  patch: {
    role: User["role"];
    status: User["status"];
    canViewHistory: boolean;
    canViewContact: boolean;
    canEdit: boolean;
  },
) {
  const supabase = await createClient();
  await done(
    await supabase
      .from("profiles")
      .update({
        role: patch.role,
        status: patch.status,
        can_view_history: patch.canViewHistory,
        can_view_contact: patch.canViewContact,
        can_edit: patch.canEdit,
      })
      .eq("id", id)
      .select("id")
      .single(),
    "Update account access",
  );
}

export async function replaceTerritories(userId: string, rows: { state: string; area: string }[]) {
  const supabase = await createClient();
  await done(await supabase.from("territories").delete().eq("user_id", userId).select("user_id"), "Clear territory");
  if (!rows.length) return;
  await done(
    await supabase
      .from("territories")
      .insert(rows.map((row) => ({ user_id: userId, state: row.state, area: row.area })))
      .select("user_id"),
    "Save territory",
  );
}

export async function writeProfile(user: User) {
  const supabase = await createClient();
  await done(
    await supabase
      .from("profiles")
      .update({
        name: user.name,
        role: user.role,
        status: user.status,
        expires_at: user.expiresAt,
        can_view_history: user.canViewHistory,
        can_view_contact: user.canViewContact,
        can_edit: user.canEdit,
      })
      .eq("id", user.id)
      .select("id"),
    "Save team member",
  );
  await done(
    await supabase.from("route_assignments").delete().eq("user_id", user.id).select("route_id"),
    "Clear route access",
  );
  if (user.assignedRouteIds.length) {
    await done(
      await supabase
        .from("route_assignments")
        .insert(user.assignedRouteIds.map((routeId) => ({ route_id: routeId, user_id: user.id })))
        .select("route_id"),
      "Save route access",
    );
  }
}

export async function removeProfile(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("profiles").delete().eq("id", id).select("id"), "Remove member");
}

export async function writeInvite(invite: Invite) {
  const supabase = await createClient();
  await done(
    await supabase
      .from("invites")
      .upsert({
        id: invite.id,
        org_id: invite.orgId,
        name: invite.name,
        email: invite.email,
        role: invite.role,
        expires_at: invite.expiresAt,
        can_view_history: invite.canViewHistory,
        can_view_contact: invite.canViewContact,
        can_edit: invite.canEdit,
        assigned_route_ids: invite.assignedRouteIds,
        accepted_at: invite.acceptedAt,
        created_at: invite.createdAt,
      })
      .select("id")
      .single(),
    "Save invite",
  );
}

export async function removeInvite(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("invites").delete().eq("id", id).select("id"), "Remove invite");
}

export async function markAllRead(userId: string, notificationIds: string[]) {
  if (!notificationIds.length) return;
  const supabase = await createClient();
  await done(
    await supabase
      .from("notification_reads")
      .upsert(
        notificationIds.map((notificationId) => ({ notification_id: notificationId, user_id: userId })),
        { onConflict: "notification_id,user_id" },
      )
      .select("notification_id"),
    "Mark notifications",
  );
}
