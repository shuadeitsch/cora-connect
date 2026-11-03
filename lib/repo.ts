import "server-only";
import type { CsvHouseholdRow } from "@/lib/csv";
import { parseContactTags } from "@/lib/contact-tags";
import { CONTACT_PROJECTS, OWNER_EMAIL, contactInTerritory, normalizeState, parseHouseholdReaction } from "@/lib/constants";
import { parseVisitStatus } from "@/lib/visit-status";
import { importWrites, planImport } from "@/lib/import-plan";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";
import { todayIso } from "@/lib/format";
import { geocodeAddress } from "@/lib/geo";
import { newId } from "@/lib/ids";
import { allowedHouseholdIds, viewerPermissions } from "@/lib/model";
import { hashPassword } from "@/lib/password";
import { loadDatabase } from "@/lib/session";
import { loadDemo, persistDemo, resetDemo } from "@/lib/store";
import { isSupabaseMode } from "@/lib/supabase/server";
import {
  markAllRead,
  patchHousehold,
  removeAllRoutes,
  removeCategory,
  removeField,
  removeHousehold,
  removeContactVisit,
  removeInvite,
  removeProfile,
  removeProject,
  removeRoute,
  removeVisit,
  replaceCategories,
  writeCategory,
  writeField,
  writeHousehold,
  writeInvite,
  replaceTerritories,
  setProfileAccess,
  writeOrganization,
  writeProfile,
  writeProject,
  writeRoute,
  writeVisit,
  writeContactVisit,
  markHouseholdsDeleted,
  softDeleteVisits,
  undoImportRows,
  patchHouseholdFlags,
  householdExists,
} from "@/lib/supabase/write";
import type {
  ActionResult,
  ContactSnapshot,
  ContactVisit,
  UndoPayload,
  ApprovalDecision,
  Category,
  CategoryInput,
  Database,
  FieldInput,
  ContactImport,
  Household,
  HouseholdInput,
  MemberInput,
  OrgInput,
  Person,
  ProjectInput,
  Reaction,
  RouteInput,
  User,
  Visit,
  VisitInput,
  VisitStatus,
} from "@/lib/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function perms(user: User) {
  return viewerPermissions(user, todayIso());
}

function blank(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStatus(value: string): VisitStatus {
  if (value === "completed" || value === "deferred") return value;
  throw new Error("Choose Completed or Deferred.");
}

function parseReaction(value: string): Reaction | null {
  const allowed: Reaction[] = ["happy", "warm", "neutral", "cold", "not_interested"];
  if (!value) return null;
  if (!allowed.includes(value as Reaction)) throw new Error("Choose a reaction, or leave it blank.");
  return value as Reaction;
}

function canSeeHousehold(db: Database, user: User, householdId: string) {
  const allowed = allowedHouseholdIds(user, db.routes);
  return !allowed || allowed.has(householdId);
}

function applyDemo(mutator: (db: Database) => void) {
  const db = loadDemo();
  mutator(db);
  persistDemo(db);
}

function territoryOf(owner: User | undefined, self: User) {
  if (owner?.territory?.length) return owner.territory;
  if (self.id === owner?.id || self.leaderId === owner?.id) return self.territory ?? [];
  return [];
}

function householdFromInput(db: Database, actor: User, input: HouseholdInput, existing: Household | undefined): { household: Household; people: Person[]; warning?: string } {
  const name = input.name.trim();
  assert(name, "Enter a name.");
  const phone = (input.people[0]?.phone ?? "").trim();
  const email = (input.people[0]?.email ?? "").trim();
  if (email && !/.+@.+\..+/.test(email)) throw new Error("Check the email address.");
  const self = db.users.find((user) => user.id === actor.id) ?? actor;
  const ownerId = self.role === "admin" ? (blank(input.ownerId) ?? self.id) : (self.leaderId ?? self.id);
  const owner = db.users.find((user) => user.id === ownerId);
  let state = normalizeState(input.state);
  const city = input.city.trim();
  const territory = territoryOf(owner, self);
  if (owner?.role === "shliach" && !state) {
    const first = territory.find((row) => normalizeState(row.state));
    if (first) state = normalizeState(first.state);
  }
  if (owner?.role === "shliach") {
    if (!state) throw new Error("A Cora admin still needs to assign your state before you can add a contact.");
    const inState = territory.some((row) => normalizeState(row.state).toLowerCase() === state.toLowerCase());
    const allowed = contactInTerritory(territory, state, city) || (!city && inState);
    assert(allowed, "That contact is outside the assigned territory.");
  }
  const sharedWithCora = owner?.role === "shliach" ? input.sharedWithCora : true;
  let projectId: string | null = null;
  if (input.projectId.trim()) {
    const project = db.projects.find((item) => item.id === input.projectId);
    const projectOk = Boolean(
      project && ((CONTACT_PROJECTS as readonly string[]).includes(project.name) || project.id === existing?.projectId),
    );
    assert(projectOk, "Choose Summer 5786 or Chanukah 5787.");
    projectId = project?.id ?? null;
  }
  const street = input.street.trim();
  const geocoded = street || city || state ? geocodeAddress(city, state, street) : null;
  const lat = geocoded?.lat ?? existing?.lat ?? null;
  const lng = geocoded?.lng ?? existing?.lng ?? null;
  const id = existing?.id ?? (input.id?.trim() || newId());
  const tags = parseContactTags(input.tags).tags;
  const customFields: Record<string, string> = {};
  for (const field of db.customFields) {
    customFields[field.id] = (input.customFields[field.id] ?? "").trim();
  }
  const people = [{
    id: input.people.find((person) => person.id)?.id || newId(),
    householdId: id,
    name,
    gender: null,
    phone,
    email,
    whatsapp: phone,
    sortOrder: 0,
  }];
  return {
    household: {
      id,
      orgId: actor.orgId,
      name,
      street: input.street.trim(),
      city,
      state,
      zip: input.zip.trim(),
      country: input.country.trim() || "USA",
      lat,
      lng,
      notes: input.notes.trim(),
      projectId,
      sharedWithCora,
      ownerId,
      visitReaction: parseHouseholdReaction(input.visitReaction),
      possibleDuplicate: existing?.possibleDuplicate ?? false,
      duplicateOf: existing?.duplicateOf ?? null,
      scheduleCategoryId: blank(input.scheduleCategoryId),
      categoryIds: input.categoryIds.filter((categoryId) => db.categories.some((category) => category.id === categoryId && category.kind === "regular")),
      tags,
      customFields,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    },
    people,
  };
}

function snapshotContact(db: Database, id: string): ContactSnapshot | null {
  const household = db.households.find((item) => item.id === id);
  if (!household) return null;
  return {
    household: { ...household, tags: [...household.tags], categoryIds: [...household.categoryIds], customFields: { ...household.customFields } },
    people: db.people.filter((person) => person.householdId === id).map((person) => ({ ...person })),
    contactVisits: (db.contactVisits ?? []).filter((visit) => visit.householdId === id).map((visit) => ({ ...visit })),
    visits: db.visits.filter((visit) => visit.householdId === id).map((visit) => ({ ...visit })),
  };
}

function visitsFromForm(actor: User, householdId: string, orgId: string, input: HouseholdInput["visits"], previous: ContactVisit[]): ContactVisit[] {
  return (input ?? []).filter((visit) => !visit.id?.startsWith("legacy-")).map((visit) => {
    const prior = visit.id ? previous.find((item) => item.id === visit.id) : undefined;
    const reaction = visit.reaction.trim() ? parseHouseholdReaction(visit.reaction) : null;
    if (visit.reaction.trim() && !reaction) throw new Error("Choose a reaction, or leave it blank.");
    const date = visit.visitDate.trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Use a visit date like 2026-10-26, or leave it blank.");
    return {
      id: prior?.id ?? newId(),
      orgId,
      householdId,
      visited: visit.visited.trim(),
      reaction,
      notes: visit.notes.trim(),
      visitDate: date || null,
      status: parseVisitStatus(visit.status ?? "").status,
      arrived: prior?.arrived ?? "",
      createdBy: prior?.createdBy ?? actor.id,
      createdAt: prior?.createdAt ?? new Date().toISOString(),
      importBatchId: prior?.importBatchId ?? null,
    };
  });
}

async function syncContactVisits(previous: ContactVisit[], next: ContactVisit[]) {
  const nextIds = new Set(next.map((visit) => visit.id));
  for (const old of previous) {
    if (!nextIds.has(old.id)) await removeContactVisit(old.id);
  }
  for (const visit of next) {
    await writeContactVisit(visit, !previous.some((item) => item.id === visit.id));
  }
}

function tableMissing(message: string) {
  return /contact_visits|schema cache|could not find the table|does not exist/i.test(message);
}

export async function saveHousehold(actor: User, input: HouseholdInput): Promise<ActionResult<{ id: string }>> {
  try {
    assert(perms(actor).canEdit, "You don't have permission to edit households.");
    const db = await loadDatabase();
    const existing = input.id ? db.households.find((household) => household.id === input.id) : undefined;
    assert(!input.id || existing, "That household is no longer here.");
    const previous = existing ? snapshotContact(db, existing.id) : null;
    const { household, people } = householdFromInput(db, actor, input, existing);
    const nextVisits = visitsFromForm(actor, household.id, household.orgId, input.visits ?? [], previous?.contactVisits ?? []);
    const undo: UndoPayload = previous
      ? { type: "replace-contact", snapshot: previous }
      : { type: "delete-created", householdIds: [household.id] };
    if (isSupabaseMode()) {
      await writeHousehold(household, people, !existing);
      if (nextVisits.length || (previous?.contactVisits.length ?? 0)) {
        try {
          await syncContactVisits(previous?.contactVisits ?? [], nextVisits);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (tableMissing(message)) {
            return { ok: true, data: { id: household.id }, warning: "Contact saved. Visit history is stored after migration 008 is applied.", undo };
          }
          throw error;
        }
      }
    } else {
      applyDemo((draft) => {
        const index = draft.households.findIndex((item) => item.id === household.id);
        if (index >= 0) draft.households[index] = household;
        else draft.households.push(household);
        draft.people = draft.people.filter((person) => person.householdId !== household.id).concat(people);
        const kept = new Set(nextVisits.map((visit) => visit.id));
        draft.contactVisits = (draft.contactVisits ?? []).filter((visit) => visit.householdId !== household.id || kept.has(visit.id));
        for (const visit of nextVisits) {
          const at = draft.contactVisits.findIndex((item) => item.id === visit.id);
          if (at >= 0) draft.contactVisits[at] = visit;
          else draft.contactVisits.push(visit);
        }
      });
    }
    return { ok: true, data: { id: household.id }, undo };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the contact." };
  }
}

export async function deleteHouseholds(actor: User, ids: string[]): Promise<ActionResult> {
  try {
    assert(perms(actor).canEdit, "You don't have permission to delete households.");
    assert(ids.length, "Select a contact first.");
    const db = await loadDatabase();
    const snapshots = ids.map((id) => snapshotContact(db, id)).filter((item): item is ContactSnapshot => Boolean(item));
    if (isSupabaseMode()) {
      const mode = await markHouseholdsDeleted(ids, true);
      if (mode === "missing") {
        for (const id of ids) await removeHousehold(id);
        return { ok: true, undo: { type: "reinsert", snapshots } };
      }
      return { ok: true, undo: { type: "restore-deleted", householdIds: ids } };
    }
    applyDemo((draft) => {
      const drop = new Set(ids);
      draft.households = draft.households.filter((household) => !drop.has(household.id));
      draft.people = draft.people.filter((person) => !drop.has(person.householdId));
      draft.visits = draft.visits.filter((visit) => !drop.has(visit.householdId));
      draft.contactVisits = (draft.contactVisits ?? []).filter((visit) => !drop.has(visit.householdId));
      for (const route of draft.routes) {
        route.stops = route.stops.filter((stop) => !drop.has(stop.householdId)).map((stop, position) => ({ ...stop, position }));
      }
    });
    return { ok: true, undo: { type: "reinsert", snapshots } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete." };
  }
}

export async function setHouseholdSchedule(actor: User, householdId: string, scheduleCategoryId: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canEdit, "You don't have permission to edit households.");
    const db = await loadDatabase();
    assert(db.households.some((household) => household.id === householdId), "That household is no longer here.");
    const next = blank(scheduleCategoryId);
    if (isSupabaseMode()) await patchHousehold(householdId, { schedule_category_id: next });
    else applyDemo((draft) => {
      const household = draft.households.find((item) => item.id === householdId);
      if (household) household.scheduleCategoryId = next;
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update the schedule." };
  }
}

export async function setHouseholdCategories(actor: User, householdId: string, categoryIds: string[]): Promise<ActionResult> {
  try {
    assert(perms(actor).canEdit, "You don't have permission to edit households.");
    const db = await loadDatabase();
    const household = db.households.find((item) => item.id === householdId);
    assert(household, "That household is no longer here.");
    const next = categoryIds.filter((id) => db.categories.some((category) => category.id === id && category.kind === "regular"));
    if (isSupabaseMode()) await replaceCategories(householdId, next);
    else applyDemo((draft) => {
      const row = draft.households.find((item) => item.id === householdId);
      if (row) row.categoryIds = next;
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update categories." };
  }
}

export async function importHouseholds(actor: User, rows: CsvHouseholdRow[]): Promise<ActionResult<{ created: number; updated: number; skipped: string[] }>> {
  try {
    assert(perms(actor).canEdit, "You don't have permission to import households.");
    assert(rows.length <= 2000, "Import 2,000 rows or fewer at a time.");
    const db = await loadDatabase();
    let created = 0;
    let updated = 0;
    const skipped: string[] = [];
    const grouped = new Map<string, CsvHouseholdRow[]>();
    rows.forEach((row, index) => {
      const name = (row.personName || row.name).trim();
      if (!name) {
        skipped.push(`Row ${index + 2}: needs a name.`);
        return;
      }
      grouped.set(String(index), [{ ...row, name, personName: name }]);
    });

    for (const group of grouped.values()) {
      const first = group[0]!;
      const projectId = db.projects.find((project) => project.name.toLowerCase() === first.project.trim().toLowerCase())?.id ?? "";
      const scheduleId = db.categories.find((category) => category.kind === "scheduled" && category.name.toLowerCase() === first.schedule.trim().toLowerCase())?.id ?? "";
      const categoryIds: string[] = [];
      for (const label of first.categories.split(/[;|]/).map((part) => part.trim()).filter(Boolean)) {
        let category = db.categories.find((item) => item.kind === "regular" && item.name.toLowerCase() === label.toLowerCase());
        if (!category) {
          category = { id: newId(), orgId: actor.orgId, name: label, kind: "regular", intervalDays: null };
          db.categories.push(category);
          if (isSupabaseMode()) await writeCategory(category);
          else applyDemo((draft) => draft.categories.push(category!));
        }
        categoryIds.push(category.id);
      }
      const existing = db.households.find((household) => household.name.toLowerCase() === first.name.trim().toLowerCase() && household.zip === first.zip.trim());
      const people = group
        .filter((row) => row.personName.trim())
        .map((row) => ({
          id: "",
          name: row.personName,
          gender: row.gender,
          phone: row.phone,
          email: row.email,
          whatsapp: row.whatsapp,
        }));
      const result = await saveHousehold(actor, {
        id: existing?.id,
        name: first.name,
        street: first.street,
        city: first.city,
        state: first.state,
        zip: first.zip,
        country: first.country || "USA",
        lat: first.lat,
        lng: first.lng,
        notes: first.notes,
        projectId,
        scheduleCategoryId: scheduleId,
        categoryIds: categoryIds.length ? categoryIds : existing?.categoryIds ?? [],
        tags: first.tags,
        customFields: existing?.customFields ?? {},
        sharedWithCora: existing?.sharedWithCora ?? true,
        ownerId: existing?.ownerId ?? "",
        visitReaction: existing?.visitReaction ?? "",
        visits: [],
        people: people.length
          ? people
          : (existing ? db.people.filter((person) => person.householdId === existing.id).map((person) => ({
              id: person.id,
              name: person.name,
              gender: person.gender ?? "",
              phone: person.phone,
              email: person.email,
              whatsapp: person.whatsapp,
            })) : []),
      });
      if (!result.ok) {
        skipped.push(`${first.name}: ${result.error}`);
        continue;
      }
      if (existing) updated += 1;
      else {
        created += 1;
        db.households.push({ id: result.data!.id, name: first.name.trim(), zip: first.zip.trim() } as Household);
      }
    }
    return { ok: true, data: { created, updated, skipped } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Import failed." };
  }
}

export async function saveVisit(actor: User, input: VisitInput): Promise<ActionResult<{ id: string }>> {
  try {
    assert(perms(actor).canLogVisit, "You don't have permission to log visits.");
    const db = await loadDatabase();
    assert(input.householdId, "Choose a contact.");
    assert(canSeeHousehold(db, actor, input.householdId), "That household isn't on your routes.");
    const date = input.visitDate.trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Enter a visit date, or leave it blank.");
    const status = input.status ? parseStatus(input.status) : null;
    const reaction = parseReaction(input.reaction);
    const existing = input.id ? db.visits.find((visit) => visit.id === input.id) : undefined;
    if (existing && existing.visitorId && existing.visitorId !== actor.id && !perms(actor).canManage) {
      throw new Error("You can edit visits you logged. An admin can edit any visit.");
    }
    const visit: Visit = {
      id: existing?.id ?? newId(),
      orgId: actor.orgId,
      householdId: input.householdId,
      visitorId: existing?.visitorId ?? actor.id,
      visitorName: existing?.visitorName ?? actor.name,
      visitDate: date,
      status,
      reaction,
      details: input.details.trim(),
      followUpDate: existing?.followUpDate ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const household = db.households.find((item) => item.id === input.householdId);
    const project = db.projects.find((item) => item.id === household?.projectId)?.name ?? "";
    const priorHistory = (db.contactVisits ?? []).find((item) => item.id === visit.id);
    const history: ContactVisit = {
      id: visit.id,
      orgId: visit.orgId,
      householdId: visit.householdId,
      visited: priorHistory?.visited || project,
      reaction: parseHouseholdReaction(input.reaction),
      notes: visit.details,
      visitDate: date || null,
      status: status ?? "completed",
      arrived: priorHistory?.arrived ?? "",
      createdBy: priorHistory?.createdBy ?? actor.id,
      createdAt: priorHistory?.createdAt ?? visit.createdAt,
      importBatchId: priorHistory?.importBatchId ?? null,
    };
    if (isSupabaseMode()) {
      await writeVisit(visit, !existing);
      await writeContactVisit(history, !priorHistory);
    } else applyDemo((draft) => {
      const index = draft.visits.findIndex((item) => item.id === visit.id);
      if (index >= 0) draft.visits[index] = visit;
      else draft.visits.push(visit);
      const historyIndex = (draft.contactVisits ?? []).findIndex((item) => item.id === history.id);
      draft.contactVisits = draft.contactVisits ?? [];
      if (historyIndex >= 0) draft.contactVisits[historyIndex] = history;
      else draft.contactVisits.push(history);
    });
    const undo: UndoPayload = existing ? { type: "replace-visit", visit: existing } : { type: "delete-visit", id: visit.id };
    return { ok: true, data: { id: visit.id }, undo };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the visit." };
  }
}

export async function deleteVisit(actor: User, id: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can delete a visit.");
    const db = await loadDatabase();
    const existing = db.visits.find((visit) => visit.id === id);
    if (isSupabaseMode()) {
      const mode = await softDeleteVisits([id], true);
      await removeContactVisit(id);
      if (mode === "missing") {
        await removeVisit(id);
        return existing ? { ok: true, undo: { type: "restore-visit", visit: existing, mode: "reinsert" } } : { ok: true };
      }
      return existing ? { ok: true, undo: { type: "restore-visit", visit: existing, mode: "undelete" } } : { ok: true };
    }
    applyDemo((draft) => {
      draft.visits = draft.visits.filter((visit) => visit.id !== id);
    });
    return existing ? { ok: true, undo: { type: "restore-visit", visit: existing, mode: "reinsert" } } : { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete the visit." };
  }
}

export async function saveRoute(actor: User, input: RouteInput): Promise<ActionResult<{ id: string }>> {
  try {
    assert(perms(actor).canCreateRoute, "You don't have permission to build routes.");
    assert(input.name.trim(), "Name the route.");
    assert(input.householdIds.length, "Add at least one stop.");
    const db = await loadDatabase();
    const existing = input.id ? db.routes.find((route) => route.id === input.id) : undefined;
    const ids = input.householdIds.filter((id) => db.households.some((household) => household.id === id && canSeeHousehold(db, actor, id)));
    assert(ids.length, "Those households aren't available to you.");
    const route = {
      id: existing?.id ?? newId(),
      orgId: actor.orgId,
      name: input.name.trim(),
      projectId: blank(input.projectId),
      optimized: input.optimized,
      createdBy: existing?.createdBy ?? actor.id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      stops: ids.map((householdId, position) => ({ householdId, position })),
    };
    if (isSupabaseMode()) await writeRoute(route);
    else applyDemo((draft) => {
      const index = draft.routes.findIndex((item) => item.id === route.id);
      if (index >= 0) draft.routes[index] = route;
      else draft.routes.push(route);
    });
    return { ok: true, data: { id: route.id } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the route." };
  }
}

export async function deleteRoute(actor: User, id: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canDeleteRoute, "Only an admin can delete a route.");
    if (isSupabaseMode()) await removeRoute(id);
    else applyDemo((draft) => {
      draft.routes = draft.routes.filter((route) => route.id !== id);
      for (const user of draft.users) user.assignedRouteIds = user.assignedRouteIds.filter((routeId) => routeId !== id);
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete the route." };
  }
}

export async function deleteAllRoutes(actor: User): Promise<ActionResult> {
  try {
    assert(perms(actor).canDeleteRoute, "Only an admin can delete routes.");
    if (isSupabaseMode()) await removeAllRoutes(actor.orgId);
    else applyDemo((draft) => {
      draft.routes = [];
      for (const user of draft.users) user.assignedRouteIds = [];
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete routes." };
  }
}

export async function saveMember(actor: User, input: MemberInput): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change the team.");
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    assert(name, "Enter a name.");
    assert(/.+@.+\..+/.test(email), "Enter a valid email.");
    const db = await loadDatabase();
    const expiresAt = blank(input.expiresAt);
    const assigned = input.assignedRouteIds.filter((id) => db.routes.some((route) => route.id === id));
    const existingUser = input.id ? db.users.find((user) => user.id === input.id) : undefined;
    const existingInvite = input.id ? db.invites.find((invite) => invite.id === input.id) : undefined;
    const emailTaken = db.users.some((user) => user.email.toLowerCase() === email && user.id !== existingUser?.id)
      || db.invites.some((invite) => invite.email.toLowerCase() === email && !invite.acceptedAt && invite.id !== existingInvite?.id);
    assert(!emailTaken, "That email is already on the team.");
    if (existingUser?.role === "admin" && input.role !== "admin") {
      const admins = db.users.filter((user) => user.role === "admin");
      assert(admins.length > 1, "Keep at least one admin on the account.");
    }

    if (existingUser) {
      const next: User = {
        ...existingUser,
        name,
        email,
        role: input.role,
        expiresAt,
        canViewHistory: input.role === "admin" ? true : input.canViewHistory,
        canViewContact: input.role === "admin" ? true : input.canViewContact,
        canEdit: input.role === "admin" ? true : input.canEdit,
        assignedRouteIds: assigned,
      };
      if (isSupabaseMode()) await writeProfile(next);
      else applyDemo((draft) => {
        const index = draft.users.findIndex((user) => user.id === next.id);
        if (index >= 0) draft.users[index] = next;
      });
      return { ok: true };
    }

    if (existingInvite || (!existingUser && isSupabaseMode())) {
      const invite = {
        id: existingInvite?.id ?? newId(),
        orgId: actor.orgId,
        name,
        email,
        role: input.role,
        expiresAt,
        canViewHistory: input.canViewHistory,
        canViewContact: input.canViewContact,
        canEdit: input.canEdit,
        assignedRouteIds: assigned,
        acceptedAt: null,
        createdAt: existingInvite?.createdAt ?? new Date().toISOString(),
      };
      if (isSupabaseMode()) await writeInvite(invite);
      else applyDemo((draft) => {
        const index = draft.invites.findIndex((item) => item.id === invite.id);
        if (index >= 0) draft.invites[index] = invite;
        else draft.invites.push(invite);
      });
      return { ok: true, warning: "Invite saved. They create an account with this email, then wait for an admin to approve them." };
    }

    const user: User = {
      id: newId(),
      orgId: actor.orgId,
      name,
      email,
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: input.role,
      status: "invited",
      expiresAt,
      canViewHistory: input.role === "admin" ? true : input.canViewHistory,
      canViewContact: input.role === "admin" ? true : input.canViewContact,
      canEdit: input.role === "admin" ? true : input.canEdit,
      assignedRouteIds: assigned,
      leaderId: null,
      territory: [],
    };
    applyDemo((draft) => draft.users.push(user));
    return { ok: true, warning: `Invite saved. In this preview they can sign in with the demo password (${DEMO_PASSWORD}).` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the team member." };
  }
}

export async function deleteMember(actor: User, id: string, kind: "member" | "invite"): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change the team.");
    assert(id !== actor.id, "You can't remove your own login.");
    const db = await loadDatabase();
    if (kind === "member") {
      const target = db.users.find((user) => user.id === id);
      if (target?.role === "admin" && db.users.filter((user) => user.role === "admin").length <= 1) {
        throw new Error("Keep at least one admin on the account.");
      }
      if (isSupabaseMode()) await removeProfile(id);
      else applyDemo((draft) => {
        draft.users = draft.users.filter((user) => user.id !== id);
      });
    } else if (isSupabaseMode()) await removeInvite(id);
    else applyDemo((draft) => {
      draft.invites = draft.invites.filter((invite) => invite.id !== id);
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not remove that person." };
  }
}

function territoryRows(states: string[], areas: string[]) {
  const cleanStates = [...new Set(states.map((state) => normalizeState(state)).filter(Boolean))];
  const cleanAreas = [...new Set(areas.map((area) => area.trim()).filter(Boolean))];
  assert(cleanStates.length, "Assign at least one state for this shliach.");
  if (!cleanAreas.length) return cleanStates.map((state) => ({ state, area: "" }));
  return cleanStates.flatMap((state) => cleanAreas.map((area) => ({ state, area })));
}

export async function setAccountApproval(
  actor: User,
  id: string,
  decision: ApprovalDecision,
  territory?: { states: string[]; areas: string[] },
): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an approved admin can approve accounts.");
    assert(id !== actor.id, "You can't change your own approval.");
    const db = await loadDatabase();
    const target = db.users.find((user) => user.id === id);
    assert(target, "That account is not on this team.");
    assert(target.email.toLowerCase() !== OWNER_EMAIL, "That login stays a Cora admin.");
    const rows = decision === "shliach" ? territoryRows(territory?.states ?? [], territory?.areas ?? []) : [];
    const patch =
      decision === "admin"
        ? { role: "admin" as const, status: "approved" as const, canViewHistory: true, canViewContact: true, canEdit: true }
        : decision === "shliach"
          ? { role: "shliach" as const, status: "approved" as const, canViewHistory: true, canViewContact: true, canEdit: true }
          : decision === "reject"
            ? { role: "visitor" as const, status: "rejected" as const, canViewHistory: false, canViewContact: false, canEdit: false }
            : { role: target.role, status: "disabled" as const, canViewHistory: false, canViewContact: false, canEdit: false };
    if (isSupabaseMode()) {
      await setProfileAccess(id, patch);
      if (decision === "shliach" || decision === "reject") await replaceTerritories(id, rows);
    } else applyDemo((draft) => {
      const index = draft.users.findIndex((user) => user.id === id);
      if (index >= 0) {
        draft.users[index] = {
          ...draft.users[index]!,
          ...patch,
          territory: decision === "shliach" ? rows : decision === "reject" ? [] : draft.users[index]!.territory,
        };
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update that account." };
  }
}

export async function importContacts(
  actor: User,
  plan: ContactImport,
): Promise<ActionResult<{ rowsRead: number; created: number; visitsMerged: number; possible: number; errors: string[]; warnings: string[] }>> {
  try {
    assert(perms(actor).canEdit, "You don't have permission to import contacts.");
    assert(plan.rows.length > 0, "Nothing to import.");
    assert(plan.rows.length <= 2000, "Import 2,000 rows or fewer at a time.");
    const db = await loadDatabase();
    const self = db.users.find((user) => user.id === actor.id) ?? actor;
    const territory = self.role === "shliach" ? (self.territory ?? []) : [];
    const fallback = plan.visitedFallback
      ? db.projects.find((item) => item.id === plan.visitedFallback)?.name || plan.visitedFallback
      : "";
    const prepared = planImport(plan.rows, db.households.map((household) => {
      const person = db.people.find((item) => item.householdId === household.id);
      const visits = (db.contactVisits ?? []).filter((visit) => visit.householdId === household.id).map((visit) => visit.visited);
      const project = db.projects.find((item) => item.id === household.projectId)?.name ?? "";
      return {
        id: household.id,
        name: person?.name || household.name,
        phone: person?.phone ?? "",
        email: person?.email ?? "",
        visited: visits.length ? visits : project ? [project] : [],
      };
    }), { territory, fallbackVisited: fallback });
    assert(prepared.rowsRead > 0, "Nothing to import.");
    const batchId = newId();
    const householdIds: string[] = [];
    const visitIds: string[] = [];
    const known = new Set(db.households.map((household) => household.id));
    let created = 0;
    let visitsMerged = 0;
    let failed = 0;
    const errors: string[] = [];
    const warnings = [...prepared.warnings];
    let flagsStored = true;
    const savedIds = new Set<string>();

    for (const contact of prepared.contacts) {
      if (!contact.existingId) continue;
      try {
        for (const visit of contact.visits) {
          const row: ContactVisit = {
            id: newId(),
            orgId: actor.orgId,
            householdId: contact.existingId,
            visited: visit.visited,
            reaction: visit.reaction,
            notes: visit.notes,
            visitDate: visit.visitDate || null,
            status: visit.status,
            arrived: "",
            createdBy: actor.id,
            createdAt: new Date().toISOString(),
            importBatchId: batchId,
          };
          if (isSupabaseMode()) await writeContactVisit(row, true);
          else applyDemo((draft) => { draft.contactVisits = [...(draft.contactVisits ?? []), row]; });
          visitIds.push(row.id);
        }
        visitsMerged += contact.fromRows;
      } catch (error) {
        failed += contact.fromRows;
        errors.push(`${contact.name}: ${error instanceof Error ? error.message : "Could not add the visit."}`);
      }
    }

    const writes = importWrites(prepared.contacts, known);
    for (const write of writes) {
      const contact = write.contact;
      const input: HouseholdInput = {
        id: write.id,
        name: contact.name,
        street: contact.street,
        city: contact.city,
        state: contact.state,
        zip: contact.zip,
        country: "USA",
        lat: "",
        lng: "",
        notes: "",
        projectId: "",
        scheduleCategoryId: "",
        categoryIds: [],
        tags: contact.tags.join(", "),
        customFields: {},
        sharedWithCora: self.role === "admin" ? true : (contact.shareWithCora ?? plan.sharedWithCora),
        ownerId: "",
        visitReaction: "",
        visits: contact.visits.map((visit) => ({
          visited: visit.visited,
          status: visit.status,
          reaction: visit.reaction ?? "",
          notes: visit.notes,
          visitDate: visit.visitDate,
        })),
        people: [{ name: contact.name, gender: "", phone: contact.phone, email: contact.email, whatsapp: "" }],
      };
      try {
        const { household, people } = householdFromInput(db, actor, input, undefined);
        household.id = write.id;
        people.forEach((person) => { person.householdId = write.id; });
        household.possibleDuplicate = contact.possibleDuplicate;
        household.duplicateOf = write.duplicateOf;
        const nextVisits = visitsFromForm(actor, household.id, household.orgId, input.visits, []).map((visit) => ({ ...visit, importBatchId: batchId }));
        if (isSupabaseMode()) {
          await writeHousehold(household, people, true, {
            importBatchId: batchId,
            possibleDuplicate: contact.possibleDuplicate,
            duplicateOf: write.duplicateOf,
          });
          if (nextVisits.length) await syncContactVisits([], nextVisits);
        } else {
          applyDemo((draft) => {
            draft.households.push(household);
            draft.people.push(...people);
            draft.contactVisits = [...(draft.contactVisits ?? []), ...nextVisits];
          });
        }
        savedIds.add(write.id);
        known.add(write.id);
        householdIds.push(household.id);
        visitIds.push(...nextVisits.map((visit) => visit.id));
        created += 1;
        visitsMerged += Math.max(0, contact.fromRows - 1);
        db.households.push(household);
      } catch (error) {
        failed += contact.fromRows;
        errors.push(`${contact.name}: ${error instanceof Error ? error.message : "Could not save the contact."}`);
      }
    }

    for (const write of writes) {
      const target = write.contact.duplicateOfId;
      if (!write.contact.possibleDuplicate || !target || write.duplicateOf || !savedIds.has(write.id) || !known.has(target)) continue;
      try {
        if (isSupabaseMode()) {
          const stored = await patchHouseholdFlags(write.id, { possible_duplicate: true, duplicate_of: target });
          if (!stored) flagsStored = false;
        } else {
          applyDemo((draft) => {
            const household = draft.households.find((item) => item.id === write.id);
            if (household) household.duplicateOf = target;
          });
        }
      } catch (error) {
        warnings.push(`${write.contact.name}: saved, but the duplicate link could not be stored. ${error instanceof Error ? error.message : ""}`.trim());
      }
    }
    if (!flagsStored) warnings.push("Possible-duplicate flags need migration 008 before they can be stored.");
    return {
      ok: true,
      data: { rowsRead: prepared.rowsRead, created, visitsMerged, possible: prepared.possible, errors, warnings },
      undo: { type: "import", batchId, householdIds, visitIds },
      warning: failed ? `${failed} row${failed === 1 ? "" : "s"} could not be saved.` : undefined,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Import failed." };
  }
}

async function restoreContact(snapshot: ContactSnapshot, create: boolean) {
  if (isSupabaseMode()) {
    if (!create) await markHouseholdsDeleted([snapshot.household.id], false);
    await writeHousehold(snapshot.household, snapshot.people, create);
    const db = await loadDatabase();
    const currentVisits = (db.contactVisits ?? []).filter((visit) => visit.householdId === snapshot.household.id);
    try {
      await syncContactVisits(currentVisits, snapshot.contactVisits);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!tableMissing(message)) throw error;
    }
    const currentLogs = db.visits.filter((visit) => visit.householdId === snapshot.household.id);
    const nextIds = new Set(snapshot.visits.map((visit) => visit.id));
    for (const old of currentLogs) {
      if (!nextIds.has(old.id)) await removeVisit(old.id);
    }
    for (const visit of snapshot.visits) {
      await writeVisit(visit, !currentLogs.some((item) => item.id === visit.id));
    }
    return;
  }
  applyDemo((draft) => {
    const index = draft.households.findIndex((item) => item.id === snapshot.household.id);
    if (index >= 0) draft.households[index] = snapshot.household;
    else draft.households.push(snapshot.household);
    draft.people = draft.people.filter((person) => person.householdId !== snapshot.household.id).concat(snapshot.people);
    const kept = new Set(snapshot.contactVisits.map((visit) => visit.id));
    draft.contactVisits = (draft.contactVisits ?? []).filter((visit) => visit.householdId !== snapshot.household.id || kept.has(visit.id));
    for (const visit of snapshot.contactVisits) {
      const at = draft.contactVisits.findIndex((item) => item.id === visit.id);
      if (at >= 0) draft.contactVisits[at] = visit;
      else draft.contactVisits.push(visit);
    }
    const logKept = new Set(snapshot.visits.map((visit) => visit.id));
    draft.visits = draft.visits.filter((visit) => visit.householdId !== snapshot.household.id || logKept.has(visit.id));
    for (const visit of snapshot.visits) {
      const at = draft.visits.findIndex((item) => item.id === visit.id);
      if (at >= 0) draft.visits[at] = visit;
      else draft.visits.push(visit);
    }
  });
}

async function moveVisitsBack(snapshot: ContactSnapshot) {
  if (isSupabaseMode()) {
    try {
      for (const visit of snapshot.contactVisits) await writeContactVisit(visit, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!tableMissing(message)) throw error;
    }
    for (const visit of snapshot.visits) await writeVisit(visit, false);
    return;
  }
  applyDemo((draft) => {
    for (const visit of snapshot.contactVisits) {
      const at = (draft.contactVisits ?? []).findIndex((item) => item.id === visit.id);
      if (at >= 0) draft.contactVisits[at] = visit;
    }
    for (const visit of snapshot.visits) {
      const at = draft.visits.findIndex((item) => item.id === visit.id);
      if (at >= 0) draft.visits[at] = visit;
    }
  });
}

function historyFromLog(visit: Visit): ContactVisit {
  return {
    id: visit.id,
    orgId: visit.orgId,
    householdId: visit.householdId,
    visited: "",
    reaction: parseHouseholdReaction(visit.reaction ?? ""),
    notes: visit.details,
    visitDate: visit.visitDate || null,
    status: visit.status ?? "completed",
    arrived: "",
    createdBy: visit.visitorId,
    createdAt: visit.createdAt,
    importBatchId: null,
  };
}

export async function applyUndo(actor: User, undo: UndoPayload): Promise<ActionResult> {
  try {
    assert(perms(actor).canEdit || perms(actor).canLogVisit, "You don't have permission to undo that.");
    if (isSupabaseMode()) {
      if (undo.type === "delete-created") {
        for (const id of undo.householdIds) await removeHousehold(id);
      } else if (undo.type === "restore-deleted") {
        await markHouseholdsDeleted(undo.householdIds, false);
      } else if (undo.type === "reinsert") {
        for (const snapshot of undo.snapshots) await restoreContact(snapshot, true);
      } else if (undo.type === "replace-contact") {
        await restoreContact(undo.snapshot, false);
      } else if (undo.type === "restore-visit") {
        if (undo.mode === "undelete") {
          const mode = await softDeleteVisits([undo.visit.id], false);
          if (mode === "missing") await writeVisit(undo.visit, true);
        } else await writeVisit(undo.visit, true);
        await writeContactVisit(historyFromLog(undo.visit), true);
      } else if (undo.type === "replace-visit") {
        await writeVisit(undo.visit, false);
        await writeContactVisit(historyFromLog(undo.visit), false);
      } else if (undo.type === "delete-visit") {
        await removeVisit(undo.id);
        await removeContactVisit(undo.id);
      } else if (undo.type === "import") {
        await undoImportRows(undo.batchId, undo.householdIds, undo.visitIds);
      } else if (undo.type === "flags") {
        await patchHouseholdFlags(undo.id, { possible_duplicate: undo.possibleDuplicate, duplicate_of: undo.duplicateOf });
      } else if (undo.type === "merge") {
        const exists = await householdExists(undo.source.household.id);
        if (exists) await markHouseholdsDeleted([undo.source.household.id], false);
        await writeHousehold(undo.source.household, undo.source.people, !exists);
        await moveVisitsBack(undo.source);
        await writeHousehold(undo.target.household, undo.target.people, false);
        await moveVisitsBack(undo.target);
      }
    } else {
      applyDemo((draft) => {
        if (undo.type === "delete-created" || undo.type === "import") {
          const homes = new Set(undo.type === "import" ? undo.householdIds : undo.householdIds);
          const visits = new Set(undo.type === "import" ? undo.visitIds : []);
          draft.households = draft.households.filter((household) => !homes.has(household.id));
          draft.people = draft.people.filter((person) => !homes.has(person.householdId));
          draft.visits = draft.visits.filter((visit) => !homes.has(visit.householdId));
          draft.contactVisits = (draft.contactVisits ?? []).filter((visit) => !homes.has(visit.householdId) && !visits.has(visit.id));
        }
      });
      if (undo.type === "restore-deleted" || undo.type === "reinsert") {
        const snapshots = undo.type === "reinsert" ? undo.snapshots : [];
        for (const snapshot of snapshots) await restoreContact(snapshot, true);
      } else if (undo.type === "replace-contact") await restoreContact(undo.snapshot, false);
      else if (undo.type === "restore-visit" || undo.type === "replace-visit") {
        applyDemo((draft) => {
          const visit = undo.type === "restore-visit" ? undo.visit : undo.visit;
          const index = draft.visits.findIndex((item) => item.id === visit.id);
          if (index >= 0) draft.visits[index] = visit;
          else draft.visits.push(visit);
        });
      } else if (undo.type === "delete-visit") {
        applyDemo((draft) => {
          draft.visits = draft.visits.filter((visit) => visit.id !== undo.id);
          draft.contactVisits = (draft.contactVisits ?? []).filter((visit) => visit.id !== undo.id);
        });
      } else if (undo.type === "flags") {
        applyDemo((draft) => {
          const household = draft.households.find((item) => item.id === undo.id);
          if (household) {
            household.possibleDuplicate = undo.possibleDuplicate;
            household.duplicateOf = undo.duplicateOf;
          }
        });
      } else if (undo.type === "merge") {
        await restoreContact(undo.source, true);
        await moveVisitsBack(undo.source);
        await restoreContact(undo.target, false);
        await moveVisitsBack(undo.target);
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not undo that." };
  }
}

export async function dismissDuplicate(actor: User, id: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canEdit, "You don't have permission to edit contacts.");
    const db = await loadDatabase();
    const household = db.households.find((item) => item.id === id);
    assert(household, "That contact is no longer here.");
    const previous = { possibleDuplicate: household.possibleDuplicate, duplicateOf: household.duplicateOf };
    if (isSupabaseMode()) {
      const stored = await patchHouseholdFlags(id, { possible_duplicate: false, duplicate_of: null });
      if (!stored) return { ok: true, warning: "Duplicate flags are stored after migration 008 is applied." };
    } else applyDemo((draft) => {
      const row = draft.households.find((item) => item.id === id);
      if (row) {
        row.possibleDuplicate = false;
        row.duplicateOf = null;
      }
    });
    return { ok: true, undo: { type: "flags", id, possibleDuplicate: previous.possibleDuplicate, duplicateOf: previous.duplicateOf } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not clear that flag." };
  }
}

export async function mergeContacts(actor: User, sourceId: string, targetId: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canEdit, "You don't have permission to edit contacts.");
    assert(sourceId !== targetId, "Choose a different contact to merge into.");
    const db = await loadDatabase();
    const source = snapshotContact(db, sourceId);
    const target = snapshotContact(db, targetId);
    assert(source && target, "That contact is no longer here.");
    if (isSupabaseMode()) {
      try {
        for (const visit of source.contactVisits) await writeContactVisit({ ...visit, householdId: targetId }, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!tableMissing(message)) throw error;
      }
      for (const visit of source.visits) await writeVisit({ ...visit, householdId: targetId }, false);
      const mode = await markHouseholdsDeleted([sourceId], true);
      if (mode === "missing") await removeHousehold(sourceId);
    } else {
      applyDemo((draft) => {
        for (const visit of draft.contactVisits ?? []) {
          if (visit.householdId === sourceId) visit.householdId = targetId;
        }
        for (const visit of draft.visits) {
          if (visit.householdId === sourceId) visit.householdId = targetId;
        }
        draft.households = draft.households.filter((household) => household.id !== sourceId);
        draft.people = draft.people.filter((person) => person.householdId !== sourceId);
      });
    }
    return { ok: true, undo: { type: "merge", source, target } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not merge those contacts." };
  }
}

export async function saveOrganization(actor: User, input: OrgInput): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change settings.");
    const db = await loadDatabase();
    const geocoded = geocodeAddress(input.city, input.state, input.street);
    const houseLat = geocoded?.lat ?? db.organization.lat;
    const houseLng = geocoded?.lng ?? db.organization.lng;
    const startLat = input.useHouseAsStart ? houseLat : numberOrNull(input.startLat) ?? houseLat;
    const startLng = input.useHouseAsStart ? houseLng : numberOrNull(input.startLng) ?? houseLng;
    const org = {
      ...db.organization,
      name: input.name.trim() || db.organization.name,
      chabadHouseName: input.chabadHouseName.trim(),
      street: input.street.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      zip: input.zip.trim(),
      country: input.country.trim() || "USA",
      lat: houseLat,
      lng: houseLng,
      startLat,
      startLng,
      defaultState: input.defaultState.trim().toUpperCase(),
    };
    if (isSupabaseMode()) await writeOrganization(org);
    else applyDemo((draft) => {
      draft.organization = org;
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save settings." };
  }
}

export async function saveCategory(actor: User, input: CategoryInput): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change categories.");
    assert(input.name.trim(), "Name the category.");
    const db = await loadDatabase();
    const existing = input.id ? db.categories.find((category) => category.id === input.id) : undefined;
    const interval = input.kind === "scheduled" && input.name.trim().toLowerCase() !== "none" ? Number(input.intervalDays) : null;
    if (input.kind === "scheduled" && input.name.trim().toLowerCase() !== "none") {
      assert(interval && interval > 0, "Enter how many days between visits.");
    }
    const category: Category = {
      id: existing?.id ?? newId(),
      orgId: actor.orgId,
      name: input.name.trim(),
      kind: input.kind,
      intervalDays: interval && interval > 0 ? interval : null,
    };
    if (isSupabaseMode()) await writeCategory(category);
    else applyDemo((draft) => {
      const index = draft.categories.findIndex((item) => item.id === category.id);
      if (index >= 0) draft.categories[index] = category;
      else draft.categories.push(category);
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the category." };
  }
}

export async function deleteCategory(actor: User, id: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change categories.");
    if (isSupabaseMode()) await removeCategory(id);
    else applyDemo((draft) => {
      draft.categories = draft.categories.filter((category) => category.id !== id);
      for (const household of draft.households) {
        if (household.scheduleCategoryId === id) household.scheduleCategoryId = null;
        household.categoryIds = household.categoryIds.filter((categoryId) => categoryId !== id);
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete the category." };
  }
}

export async function saveProject(actor: User, input: ProjectInput): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change projects.");
    assert(input.name.trim(), "Name the project.");
    const db = await loadDatabase();
    const existing = input.id ? db.projects.find((project) => project.id === input.id) : undefined;
    const project = { id: existing?.id ?? newId(), orgId: actor.orgId, name: input.name.trim() };
    if (isSupabaseMode()) await writeProject(project);
    else applyDemo((draft) => {
      const index = draft.projects.findIndex((item) => item.id === project.id);
      if (index >= 0) draft.projects[index] = project;
      else draft.projects.push(project);
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the project." };
  }
}

export async function deleteProject(actor: User, id: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change projects.");
    if (isSupabaseMode()) await removeProject(id);
    else applyDemo((draft) => {
      draft.projects = draft.projects.filter((project) => project.id !== id);
      for (const household of draft.households) if (household.projectId === id) household.projectId = null;
      for (const route of draft.routes) if (route.projectId === id) route.projectId = null;
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete the project." };
  }
}

export async function saveCustomField(actor: User, input: FieldInput): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change custom fields.");
    assert(input.name.trim(), "Name the field.");
    const db = await loadDatabase();
    const existing = input.id ? db.customFields.find((field) => field.id === input.id) : undefined;
    const options = input.options.split(",").map((option) => option.trim()).filter(Boolean);
    if (input.fieldType === "select") assert(options.length, "Add at least one choice, separated by commas.");
    const field = {
      id: existing?.id ?? newId(),
      orgId: actor.orgId,
      name: input.name.trim(),
      fieldType: input.fieldType,
      options: input.fieldType === "select" ? options : [],
    };
    if (isSupabaseMode()) await writeField(field);
    else applyDemo((draft) => {
      const index = draft.customFields.findIndex((item) => item.id === field.id);
      if (index >= 0) draft.customFields[index] = field;
      else draft.customFields.push(field);
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the field." };
  }
}

export async function deleteCustomField(actor: User, id: string): Promise<ActionResult> {
  try {
    assert(perms(actor).canManage, "Only an admin can change custom fields.");
    const db = await loadDatabase();
    if (isSupabaseMode()) {
      const supabaseWrites = db.households.filter((household) => household.customFields[id] != null);
      for (const household of supabaseWrites) {
        const customFields = { ...household.customFields };
        delete customFields[id];
        await writeHousehold({ ...household, customFields }, db.people.filter((person) => person.householdId === household.id), false);
      }
      await removeField(id);
    } else {
      applyDemo((draft) => {
        draft.customFields = draft.customFields.filter((field) => field.id !== id);
        for (const household of draft.households) delete household.customFields[id];
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete the field." };
  }
}

export async function readNotifications(actor: User): Promise<ActionResult> {
  try {
    const db = await loadDatabase();
    const ids = db.notifications.map((note) => note.id);
    if (isSupabaseMode()) await markAllRead(actor.id, ids);
    else applyDemo((draft) => {
      for (const note of draft.notifications) {
        if (!note.readBy.includes(actor.id)) note.readBy.push(actor.id);
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update notifications." };
  }
}

export async function resetDemoData(actor: User): Promise<ActionResult> {
  try {
    assert(!isSupabaseMode(), "Reset is only for the local preview. Use the seed script for Supabase.");
    assert(perms(actor).canManage, "Only an admin can reset the sample data.");
    resetDemo();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reset." };
  }
}
