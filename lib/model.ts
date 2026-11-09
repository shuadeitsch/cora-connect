import { sameState } from "@/lib/constants";
import { addDays, monthKey, weekStart } from "@/lib/format";
import { miles } from "@/lib/geo";
import type {
  Category,
  DueState,
  Household,
  Reaction,
  Role,
  Route,
  Stats,
  User,
  Visit,
  VisitStatus,
} from "@/lib/types";

export function viewerPermissions(user: User, today: string) {
  const approved = user.status === "approved";
  const expired = approved && Boolean(user.expiresAt && user.expiresAt < today);
  const admin = approved && user.role === "admin" && !expired;
  const shliach = approved && user.role === "shliach" && !expired;
  const bochur = user.role === "bochur";
  const active = approved && !expired;
  // A bochur only ever reaches contacts shared with him (the database enforces it); on those he sees everything.
  const canEdit = active && !bochur && (admin || shliach || user.canEdit);
  return {
    expired,
    canViewHistory: active && (admin || shliach || bochur || user.canViewHistory),
    canViewContact: active && (admin || shliach || bochur || user.canViewContact),
    canEdit,
    canManage: admin,
    canLogVisit: active && (admin || shliach || bochur || user.role === "visitor" || user.canEdit),
    canCreateRoute: active && (admin || shliach || bochur || user.role === "visitor"),
    canDeleteRoute: admin,
    // Soft-hide for shliach; hard delete stays admin-only in the repo.
    canDeleteContacts: canEdit && (admin || shliach),
    canImport: canEdit && !shliach,
    canShare: admin || shliach,
  };
}

// Mirrors public.can_edit_household so the app only offers what the database allows.
export function canEditContact(user: User, ownerId: string | null, users: User[], today: string, shared = false, state = "", city = "") {
  const perms = viewerPermissions(user, today);
  if (!perms.canEdit) return false;
  if (user.role === "admin") return true;
  if (!ownerId) return false;
  if (ownerId === user.id) return true;
  if (user.leaderId && ownerId === user.leaderId) return true;
  if (user.role === "shliach" && shared && state && inTerritory(state, city, user.territory ?? [])) return true;
  return users.some((member) => member.id === ownerId && member.leaderId === user.id);
}

/** Stored order for a not-duplicate pair: low id first. */
export function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Admins and editors may mark "Not a duplicate"; a shliach only on his own contacts; never a bochur. */
export function canMarkNotDuplicate(user: User, ownerId: string | null, users: User[], today: string, shared = false, state = "", city = "") {
  if (user.role === "bochur") return false;
  if (!canEditContact(user, ownerId, users, today, shared, state, city)) return false;
  if (user.role === "shliach") return ownerId === user.id;
  return true;
}

export function dueInfo(
  intervalDays: number | null,
  createdAt: string,
  visits: { visitDate: string; status: VisitStatus | null }[],
  today: string,
): { nextDue: string | null; dueState: DueState } {
  if (!intervalDays) return { nextDue: null, dueState: "none" };
  const completed = visits
    .filter((visit) => visit.status === "completed" && /^\d{4}-\d{2}-\d{2}$/.test(visit.visitDate))
    .map((visit) => visit.visitDate)
    .sort();
  const anchor = completed.length ? completed[completed.length - 1] : createdAt.slice(0, 10);
  const nextDue = addDays(anchor, intervalDays);
  if (nextDue < today) return { nextDue, dueState: "overdue" };
  if (nextDue <= addDays(today, 7)) return { nextDue, dueState: "due" };
  return { nextDue, dueState: "upcoming" };
}

function inTerritory(state: string, city: string, territory: { state: string; area: string }[]) {
  return territory.some((row) => sameState(row.state, state) && (!row.area.trim() || row.area.trim().toLowerCase() === city.trim().toLowerCase()));
}


/** Households this role may see. Used by present() so Beta preview matches live role views. */
export function householdVisibleTo(
  user: User,
  household: Household,
  users: User[],
  contactShares?: { householdId: string; bochurId: string }[],
): boolean {
  if (user.role === "admin") return true;
  if (household.deletedByShliachAt) return false;
  if (user.role === "limited") return true; // allowedHouseholdIds handles limited
  if (user.role === "bochur") {
    // Live bochur lists are already RLS-scoped (share + leader territory).
    // Beta preview approximates: shared with some bochur AND in the picked state territory.
    if (!user.previewing) return true;
    const shared = (contactShares ?? []).some((share) => share.householdId === household.id) || household.sharedWithCora;
    const inTerr = inTerritory(household.state, household.city, user.territory ?? []);
    return shared && inTerr;
  }
  if (user.role === "shliach") {
    if (household.ownerId === user.id) return true;
    if (users.some((member) => member.id === household.ownerId && member.leaderId === user.id)) return true;
    if (household.sharedWithCora && household.state && inTerritory(household.state, household.city, user.territory ?? [])) return true;
    return false;
  }
  return true;
}

export function allowedHouseholdIds(user: User, routes: Route[]): Set<string> | null {
  if (user.role !== "limited") return null;
  const ids = new Set<string>();
  for (const route of routes) {
    if (!user.assignedRouteIds.includes(route.id)) continue;
    for (const stop of route.stops) ids.add(stop.householdId);
  }
  return ids;
}

export function emptyReactions(): Record<Reaction, number> {
  return { happy: 0, warm: 0, neutral: 0, cold: 0, not_interested: 0 };
}

export function buildActivity(visitDates: string[], today: string): { label: string; count: number }[] {
  const start = weekStart(today);
  const weeks: string[] = [];
  for (let i = 7; i >= 0; i--) weeks.push(addDays(start, -7 * i));
  return weeks.map((week) => ({
    label: week.slice(5).replace("-", "/"),
    count: visitDates.filter((date) => weekStart(date) === week).length,
  }));
}

export function categoryCounts(
  households: { categoryIds: string[] }[],
  categories: Category[],
): { name: string; count: number }[] {
  const regular = categories.filter((category) => category.kind === "regular");
  return regular
    .map((category) => ({
      name: category.name,
      count: households.filter((household) => household.categoryIds.includes(category.id)).length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function roleCounts(users: Pick<User, "role">[]): Record<Role, number> {
  return {
    admin: users.filter((user) => user.role === "admin").length,
    shliach: users.filter((user) => user.role === "shliach").length,
    bochur: users.filter((user) => user.role === "bochur").length,
    visitor: users.filter((user) => user.role === "visitor").length,
    limited: users.filter((user) => user.role === "limited").length,
  };
}

export function sumStops(routes: { stops: { householdId: string }[] }[]): number {
  return routes.reduce((sum, route) => sum + route.stops.length, 0);
}

export function householdsThisMonth(households: Pick<Household, "createdAt">[], today: string): number {
  const month = monthKey(today);
  return households.filter((household) => monthKey(household.createdAt) === month).length;
}

export function visitsThisMonth(visits: Pick<Visit, "visitDate">[], today: string): number {
  const month = monthKey(today);
  return visits.filter((visit) => monthKey(visit.visitDate) === month).length;
}

export function checklistFor(input: {
  orgStreet: string;
  startLat: number | null;
  householdCount: number;
  routeCount: number;
  visitCount: number;
}): Stats["checklist"] {
  return {
    chabadHouse: input.orgStreet.trim().length > 0,
    startPoint: input.startLat != null,
    imported: input.householdCount > 0,
    route: input.routeCount > 0,
    visit: input.visitCount > 0,
  };
}

export function legMiles(
  points: { lat: number | null; lng: number | null }[],
): number | null {
  const located = points.filter(
    (point): point is { lat: number; lng: number } => point.lat != null && point.lng != null,
  );
  if (located.length < 2) return located.length ? 0 : null;
  let total = 0;
  for (let i = 1; i < located.length; i++) total += miles(located[i - 1], located[i]);
  return Math.round(total * 10) / 10;
}
