import { parseHouseholdReaction } from "@/lib/constants";
import { isRealVisit } from "@/lib/visited";
import { monthKey, fullAddress } from "@/lib/format";
import { legMiles } from "@/lib/model";
import {
  allowedHouseholdIds,
  buildActivity,
  canEditContact,
  categoryCounts,
  checklistFor,
  dueInfo,
  emptyReactions,
  householdsThisMonth,
  roleCounts,
  sumStops,
  viewerPermissions,
} from "@/lib/model";
import type {
  AppData,
  ContactVisit,
  Database,
  Household,
  HouseholdView,
  Person,
  RouteView,
  TeamMember,
  User,
  VisitView,
} from "@/lib/types";

function sortOutreach(rows: ContactVisit[]) {
  return [...rows].sort((a, b) => {
    const ad = a.visitDate ?? "";
    const bd = b.visitDate ?? "";
    if (ad !== bd) {
      if (!ad) return 1;
      if (!bd) return -1;
      return bd.localeCompare(ad);
    }
    const byName = a.visited.localeCompare(b.visited);
    if (byName) return byName;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function outreachFor(db: Database, household: Household): ContactVisit[] {
  const removed = new Set(db.removedVisitIds ?? []);
  const stored = (db.contactVisits ?? []).filter((visit) => visit.householdId === household.id && !removed.has(visit.id));
  const byId = new Map(stored.map((visit) => [visit.id, visit]));
  const project = db.projects.find((item) => item.id === household.projectId)?.name ?? "";
  for (const log of db.visits.filter((visit) => visit.householdId === household.id)) {
    if (byId.has(log.id) || removed.has(log.id)) continue;
    byId.set(log.id, {
      id: log.id,
      orgId: log.orgId,
      householdId: log.householdId,
      visited: project,
      reaction: parseHouseholdReaction(log.reaction ?? ""),
      notes: log.details,
      visitDate: log.visitDate || null,
      status: log.status === "deferred" ? "deferred" : "completed",
      arrived: "",
      createdBy: log.visitorId,
      createdAt: log.createdAt,
      importBatchId: null,
    });
  }
  if (byId.size || db.contactVisitsReady) return sortOutreach([...byId.values()]);
  if (!project && !household.visitReaction && !household.notes.trim()) return [];
  return [{
    id: `legacy-${household.id}`,
    orgId: household.orgId,
    householdId: household.id,
    visited: project,
    reaction: household.visitReaction,
    notes: household.notes,
    visitDate: null,
    status: "completed",
    arrived: "",
    createdBy: null,
    createdAt: household.createdAt,
    importBatchId: null,
  }];
}

function peopleFor(db: Database, householdId: string, hideContact: boolean): Person[] {
  return db.people
    .filter((person) => person.householdId === householdId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((person) =>
      hideContact
        ? { ...person, phone: "", email: "", whatsapp: "" }
        : person,
    );
}

export function present(source: Database, user: User, mode: AppData["mode"], today: string): AppData {
  // A removed visit is gone from History, Reports, and the dashboard alike.
  const removedIds = new Set(source.removedVisitIds ?? []);
  const db: Database = removedIds.size ? { ...source, visits: source.visits.filter((visit) => !removedIds.has(visit.id)) } : source;
  const perms = viewerPermissions(user, today);
  const allowed = allowedHouseholdIds(user, db.routes);
  const visibleHouseholds = db.households.filter((household) => !allowed || allowed.has(household.id));
  const visibleIds = new Set(visibleHouseholds.map((household) => household.id));
  const hideContact = !perms.canViewContact;
  const hideHistory = !perms.canViewHistory;

  const households: HouseholdView[] = visibleHouseholds
    .map((household) => {
      const schedule = db.categories.find((category) => category.id === household.scheduleCategoryId);
      const project = db.projects.find((item) => item.id === household.projectId);
      const householdVisits = db.visits
        .filter((visit) => visit.householdId === household.id)
        .sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt));
      const due = dueInfo(schedule?.intervalDays ?? null, household.createdAt, householdVisits, today);
      const last = householdVisits[0] ?? null;
      const people = peopleFor(db, household.id, hideContact);
      const displayName = people.map((person) => person.name.trim()).find(Boolean) || household.name;
      const editsContact = canEditContact(user, household.ownerId, db.users, today);
      const contactVisits = outreachFor(db, household).map((visit) => ({
        id: visit.id,
        visited: visit.visited,
        reaction: hideHistory ? null : visit.reaction,
        notes: hideHistory ? "" : visit.notes,
        visitDate: visit.visitDate,
        status: visit.status,
        createdAt: visit.createdAt,
        canRemove: visit.id.startsWith("legacy-")
          ? editsContact
          : editsContact || (perms.canLogVisit && visit.createdBy === user.id),
      }));
      const latest = contactVisits[0] ?? null;
      const realVisits = contactVisits.filter((visit) => isRealVisit(visit.visited));
      const duplicateOfName = household.duplicateOf
        ? visibleHouseholds.find((item) => item.id === household.duplicateOf)?.name
          ?? db.people.find((person) => person.householdId === household.duplicateOf && person.name.trim())?.name
          ?? null
        : null;
      return {
        id: household.id,
        name: displayName,
        street: household.street,
        city: household.city,
        state: household.state,
        zip: household.zip,
        country: household.country,
        lat: household.lat,
        lng: household.lng,
        notes: household.notes,
        projectId: household.projectId,
        projectName: project?.name ?? null,
        scheduleCategoryId: household.scheduleCategoryId,
        scheduleName: !schedule || schedule.intervalDays == null ? "None" : schedule.name,
        intervalDays: schedule?.intervalDays ?? null,
        categoryIds: household.categoryIds,
        categoryNames: household.categoryIds
          .map((id) => db.categories.find((category) => category.id === id)?.name)
          .filter((name): name is string => Boolean(name)),
        tags: household.tags,
        customFields: household.customFields,
        sharedWithCora: household.sharedWithCora,
        ownerId: household.ownerId,
        visitReaction: household.visitReaction,
        possibleDuplicate: household.possibleDuplicate,
        duplicateOf: household.duplicateOf,
        duplicateOfName,
        contactVisits,
        latestVisited: realVisits[0]?.visited ?? "",
        latestReaction: latest?.reaction ?? null,
        visitCount: realVisits.length,
        createdAt: household.createdAt,
        people,
        lastVisitAt: last?.visitDate ?? null,
        lastStatus: last?.status ?? null,
        nextDue: due.nextDue,
        dueState: due.dueState,
        address: fullAddress(household),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const visits: VisitView[] = db.visits
    .filter((visit) => visibleIds.has(visit.householdId))
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate) || b.createdAt.localeCompare(a.createdAt))
    .map((visit) => {
      const household = households.find((item) => item.id === visit.householdId);
      return {
        id: visit.id,
        householdId: visit.householdId,
        householdName: household?.name ?? "Household",
        visitorId: visit.visitorId,
        visitorName: visit.visitorName,
        visitDate: visit.visitDate,
        status: visit.status,
        reaction: hideHistory ? null : visit.reaction,
        details: hideHistory ? "" : visit.details,
        followUpDate: visit.followUpDate,
        scheduleName: household?.scheduleName ?? "None",
        categoryNames: household?.categoryNames ?? [],
        projectName: household?.projectName ?? null,
        createdAt: visit.createdAt,
      };
    });

  const visibleRoutes = db.routes.filter(
    (route) => user.role !== "limited" || user.assignedRouteIds.includes(route.id),
  );

  const routes: RouteView[] = visibleRoutes
    .map((route) => {
      const stops = [...route.stops]
        .sort((a, b) => a.position - b.position)
        .map((stop) => {
          const household = db.households.find((item) => item.id === stop.householdId);
          const person = db.people.find((item) => item.householdId === stop.householdId && item.name.trim());
          return {
            householdId: stop.householdId,
            position: stop.position,
            name: person?.name.trim() || household?.name || "Removed contact",
            street: household?.street ?? "",
            city: household?.city ?? "",
            state: household?.state ?? "",
            zip: household?.zip ?? "",
            lat: household?.lat ?? null,
            lng: household?.lng ?? null,
            phone: hideContact ? "" : person?.phone ?? "",
          };
        });
      return {
        id: route.id,
        name: route.name,
        projectId: route.projectId,
        projectName: db.projects.find((project) => project.id === route.projectId)?.name ?? "Unsorted Routes",
        optimized: route.optimized,
        createdAt: route.createdAt.slice(0, 10),
        stopCount: stops.length,
        stops,
        miles: legMiles(stops),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const reactions = emptyReactions();
  if (!hideHistory) {
    for (const visit of visits) {
      if (visit.reaction) reactions[visit.reaction] += 1;
    }
  }

  const month = monthKey(today);
  const recentVisits = visits.slice(0, 6).map((visit) => ({
    id: visit.id,
    householdId: visit.householdId,
    householdName: visit.householdName,
    visitorName: visit.visitorName,
    status: visit.status,
    reaction: visit.reaction,
    visitDate: visit.visitDate,
    details: visit.details,
  }));

  const dueThisWeek = households
    .filter((household) => household.dueState === "due" || household.dueState === "overdue")
    .sort((a, b) => {
      if (a.dueState !== b.dueState) return a.dueState === "overdue" ? -1 : 1;
      return (a.nextDue ?? "").localeCompare(b.nextDue ?? "");
    })
    .slice(0, 6)
    .map((household) => ({
      id: household.id,
      name: household.name,
      schedule: household.scheduleName,
      overdue: household.dueState === "overdue",
      nextDue: household.nextDue,
    }));

  const roster: TeamMember[] =
    user.role === "limited"
      ? []
      : db.users.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          status: member.status,
          expiresAt: member.expiresAt,
          canViewHistory: member.canViewHistory,
          canViewContact: member.canViewContact,
          canEdit: member.canEdit,
          assignedRouteIds: member.assignedRouteIds,
          leaderId: member.leaderId,
          territory: member.territory ?? [],
          kind: "member" as const,
        }));

  if (perms.canManage) {
    for (const invite of db.invites.filter((item) => !item.acceptedAt)) {
      if (roster.some((member) => member.email.toLowerCase() === invite.email.toLowerCase())) continue;
      roster.push({
        id: invite.id,
        name: invite.name || invite.email,
        email: invite.email,
        role: invite.role,
        status: "invited",
        expiresAt: invite.expiresAt,
        canViewHistory: invite.canViewHistory,
        canViewContact: invite.canViewContact,
        canEdit: invite.canEdit,
        assignedRouteIds: invite.assignedRouteIds,
        leaderId: null,
        territory: [],
        kind: "invite",
      });
    }
  }

  return {
    mode,
    viewer: {
      id: user.id,
      orgId: user.orgId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      expiresAt: user.expiresAt,
      leaderId: user.leaderId ?? null,
      territory: user.territory ?? [],
      ...perms,
    },
    org: db.organization,
    members: roster,
    projects: db.projects,
    categories: db.categories,
    customFields: db.customFields,
    households,
    visits,
    routes,
    notifications: db.notifications
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((note) => ({
        id: note.id,
        title: note.title,
        body: note.body,
        createdAt: note.createdAt,
        read: note.readBy.includes(user.id),
      })),
    stats: {
      householdCount: households.length,
      householdsThisMonth: householdsThisMonth(households, today),
      planLimit: db.organization.planLimit,
      visitsThisMonth: visits.filter((visit) => monthKey(visit.visitDate) === month).length,
      routeCount: routes.length,
      optimizedRoutes: routes.filter((route) => route.optimized).length,
      stopCount: sumStops(routes),
      teamCount: user.role === "limited" ? db.users.length : roster.filter((m) => m.kind === "member").length,
      roleCounts: roleCounts(user.role === "limited" ? db.users : db.users),
      activity: buildActivity(
        visits.map((visit) => visit.visitDate),
        today,
      ),
      reactions,
      topCategories: categoryCounts(households, db.categories),
      dueThisWeek,
      recentVisits,
      checklist: checklistFor({
        orgStreet: db.organization.street,
        startLat: db.organization.startLat,
        householdCount: db.households.length,
        routeCount: db.routes.length,
        visitCount: db.visits.length,
      }),
    },
  };
}
