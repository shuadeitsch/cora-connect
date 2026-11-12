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
    created_by: household.createdBy ?? null,
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
    const { id, created_at, created_by, ...patch } = flagged;
    void id;
    void created_at;
    void created_by;
    let updated = await supabase.from("households").update(patch).eq("id", household.id);
    if (updated.error && extras && missingColumn(updated.error.message)) {
      const plain = householdRow(household);
      const { id: plainId, created_at: created, created_by: createdBy, ...plainPatch } = plain;
      void plainId;
      void created;
      void createdBy;
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
          phone2: person.phone2 || null,
          phone3: person.phone3 || null,
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
    project_id: visit.projectId,
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

export async function markShliachHidden(ids: string[], hidden: boolean): Promise<void> {
  if (!ids.length) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;
  const patch = hidden
    ? { deleted_by_shliach_at: new Date().toISOString(), deleted_by_shliach_by: uid }
    : { deleted_by_shliach_at: null, deleted_by_shliach_by: null };
  const result = await supabase.from("households").update(patch).in("id", ids);
  if (result.error) throw new Error(result.error.message);
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
    visited_by: visit.visitedBy ?? null,
    reaction: visit.reaction,
    notes: visit.notes,
    visit_date: visit.visitDate,
    status: visit.status,
    arrived: visit.arrived,
    created_by: visit.createdBy,
    project_id: visit.projectId,
    created_at: visit.createdAt,
    import_batch_id: visit.importBatchId,
    activities: visit.activities ?? [],
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
    if (/activities/i.test(result.error.message)) delete payload.activities;
    if (/visited_by/i.test(result.error.message)) delete payload.visited_by;
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

// Soft delete. Database rules decide who may: anyone who can edit the
// contact, or the person who logged the visit. A blocked update changes no
// rows and returns no error, so read the row back to be sure.
export async function setContactVisitRemoved(id: string, removed: boolean) {
  const supabase = await createClient();
  await done(
    await supabase.from("contact_visits").update({ deleted_at: removed ? new Date().toISOString() : null }).eq("id", id),
    removed ? "Remove visit" : "Restore visit",
  );
  const check = await supabase.from("contact_visits").select("id, deleted_at").eq("id", id).maybeSingle();
  if (check.error) throw new Error(`${removed ? "Remove visit" : "Restore visit"}: ${check.error.message}`);
  const row = check.data as { deleted_at: string | null } | null;
  if (!row || Boolean(row.deleted_at) !== removed) {
    throw new Error(removed ? "You can't remove this visit." : "You can't restore this visit.");
  }
}

// Reports log row. Same read-back as above, since a blocked update is silent.
export async function setVisitLogRemoved(id: string, removed: boolean) {
  const supabase = await createClient();
  await done(
    await supabase.from("visits").update({ deleted_at: removed ? new Date().toISOString() : null }).eq("id", id),
    removed ? "Remove visit" : "Restore visit",
  );
  const check = await supabase.from("visits").select("id, deleted_at").eq("id", id).maybeSingle();
  if (check.error) throw new Error(`${removed ? "Remove visit" : "Restore visit"}: ${check.error.message}`);
  const row = check.data as { deleted_at: string | null } | null;
  if (!row || Boolean(row.deleted_at) !== removed) {
    throw new Error(removed ? "You can't remove this visit." : "You can't restore this visit.");
  }
}

// The visit stored on the contact itself before Visit History existed.
export async function setLegacyVisitFields(
  id: string,
  fields: { project_id: string | null; visit_reaction: string | null; notes: string },
) {
  const supabase = await createClient();
  await done(await supabase.from("households").update(fields).eq("id", id), "Remove visit");
  const check = await supabase.from("households").select("project_id, visit_reaction, notes").eq("id", id).maybeSingle();
  if (check.error) throw new Error(`Remove visit: ${check.error.message}`);
  const row = check.data as { project_id: string | null; visit_reaction: string | null; notes: string | null } | null;
  if (!row || row.project_id !== fields.project_id || row.visit_reaction !== fields.visit_reaction || (row.notes ?? "") !== fields.notes) {
    throw new Error("You can't change this visit.");
  }
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

/** Record (or forget, for Undo) that two contacts are confirmed not the same. */
export async function setNotDuplicatePair(orgId: string, a: string, b: string, on: boolean) {
  const [low, high] = a < b ? [a, b] : [b, a];
  const supabase = await createClient();
  const result = on
    ? await supabase.from("not_duplicate_pairs").upsert({ a_id: low, b_id: high, org_id: orgId }, { onConflict: "a_id,b_id", ignoreDuplicates: true })
    : await supabase.from("not_duplicate_pairs").delete().eq("a_id", low).eq("b_id", high);
  if (result.error) throw new Error(`Not a duplicate: ${result.error.message}`);
}

/**
 * `replaceIds` (updates only): the stops this person may change. Other stops on the route (contacts they
 * can't see) are left exactly as they are, so editing never drops someone else's stops.
 */
export async function writeRoute(route: Route, isNew: boolean, replaceIds?: string[]) {
  const supabase = await createClient();
  const row = {
    org_id: route.orgId,
    name: route.name,
    project_id: route.projectId,
    optimized: route.optimized,
  };
  if (isNew) {
    // Plain insert with no RETURNING: the routes SELECT policy (can_see_route) looks the row up in the table,
    // and a row being inserted isn't there yet, so insert-with-returning or upsert fails RLS for everyone.
    await done(
      await supabase.from("routes").insert({ id: route.id, ...row, created_by: route.createdBy, created_at: route.createdAt }),
      "Save route",
    );
  } else {
    const updated = await supabase.from("routes").update(row).eq("id", route.id).select("id");
    await done(updated, "Save route");
    if (!updated.data?.length) throw new Error("Save route: that route is no longer available to you.");
  }
  if (isNew || !replaceIds) {
    await done(await supabase.from("route_stops").delete().eq("route_id", route.id).select("id"), "Replace stops");
  } else {
    const remove = [...new Set([...replaceIds, ...route.stops.map((stop) => stop.householdId)])];
    if (remove.length) {
      await done(await supabase.from("route_stops").delete().eq("route_id", route.id).in("household_id", remove).select("id"), "Replace stops");
    }
  }
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
  // Read the route back so a save is only reported once the database really has it with every stop.
  const saved = await supabase.from("routes").select("id, name, route_stops(household_id, position)").eq("id", route.id).maybeSingle();
  await done(saved, "Check route");
  if (!saved.data) throw new Error("Check route: the route didn't save.");
  const back = (saved.data as { name: string; route_stops?: { household_id: string; position: number }[] }).route_stops ?? [];
  const position = new Map(back.map((stop) => [stop.household_id, stop.position]));
  const missing = route.stops.filter((stop) => position.get(stop.householdId) !== stop.position).length;
  if (missing) throw new Error(`Check route: only ${route.stops.length - missing} of ${route.stops.length} stops saved.`);
  if ((saved.data as { name: string }).name !== route.name) throw new Error("Check route: the new name didn't save.");
}

export async function removeRoute(id: string) {
  const supabase = await createClient();
  await done(await supabase.from("routes").delete().eq("id", id).select("id"), "Delete route");
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

/** Step one for a bochur: a Cora admin picks his shliach. The database keeps him pending until that shliach approves. */
export async function setBochurAdminApproval(id: string, leaderId: string) {
  const supabase = await createClient();
  await done(
    await supabase
      .from("profiles")
      .update({ role: "bochur", status: "approved", leader_id: leaderId, can_view_history: true, can_view_contact: true, can_edit: false })
      .eq("id", id)
      .select("id")
      .single(),
    "Approve bochur",
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
        territory_states: [...new Set(invite.territory.map((row) => row.state).filter(Boolean))],
        territory_areas: [...new Set(invite.territory.map((row) => row.area.trim()).filter(Boolean))],
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
