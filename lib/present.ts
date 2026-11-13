import { mailSetupStatus } from "@/lib/mail-status";
import { activityCountsFor } from "@/lib/visit-activities";
import { findLiveDuplicates } from "@/lib/duplicate-reason";
import { isListedProject, listedProjects, parseHouseholdReaction, projectLabel } from "@/lib/constants";
import { isRealVisit } from "@/lib/visited";
import { monthKey, fullAddress } from "@/lib/format";
import { parseExtraAddresses } from "@/lib/extra-addresses";
import { legMiles } from "@/lib/model";
import {
  allowedHouseholdIds,
  householdVisibleTo,
  previewBochurIds,
  buildActivity,
  canEditContact,
  canMarkNotDuplicate,
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
      activities: [],
      importBatchId: null,
      projectId: log.projectId ?? household.projectId ?? null,
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
    activities: [],
    importBatchId: null,
    projectId: household.projectId ?? null,
  }];
}

function peopleFor(db: Database, householdId: string, hideContact: boolean): Person[] {
  return db.people
    .filter((person) => person.householdId === householdId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((person) =>
      hideContact
        ? { ...person, phone: "", phone2: "", phone3: "", email: "", whatsapp: "" }
        : person,
    );
}

export function present(source: Database, user: User, mode: AppData["mode"], today: string): AppData {
  // A removed visit is gone from History, Reports, and the dashboard alike.
  const removedIds = new Set(source.removedVisitIds ?? []);
  const db: Database = removedIds.size ? { ...source, visits: source.visits.filter((visit) => !removedIds.has(visit.id)) } : source;
  const perms = viewerPermissions(user, today);
  const allowed = allowedHouseholdIds(user, db.routes);
  const visibleHouseholds = db.households.filter((household) => {
    if (allowed && !allowed.has(household.id)) return false;
    return householdVisibleTo(user, household, db.users, db.contactShares);
  });
  const peopleBy = new Map<string, typeof db.people>();
  for (const person of db.people) {
    const list = peopleBy.get(person.householdId);
    if (list) list.push(person);
    else peopleBy.set(person.householdId, [person]);
  }
  const visibleIds = new Set(visibleHouseholds.map((household) => household.id));
  const hideContact = !perms.canViewContact;
  const notDup = new Set(db.notDuplicatePairs ?? []);
  const hideHistory = !perms.canViewHistory;
  const liveDups = findLiveDuplicates(visibleHouseholds, peopleBy, notDup);

  // For a shliach, "shared with bochurim" means shared with every one of his active bochurim (or none if he has none).
  // In Beta preview the viewer id is still the admin's, so use the territory shliach's bochurim.
  const myBochurIds = user.previewing
    ? previewBochurIds(user, db.users)
    : db.users
        .filter((member) => {
          if (member.role !== "bochur" || member.status !== "approved") return false;
          if (user.role === "admin") return true;
          if (user.role === "shliach") return member.leaderId === user.id;
          if (user.role === "bochur") return member.leaderId === user.leaderId;
          return false;
        })
        .map((member) => member.id);
  const sharesByHousehold = new Map<string, Set<string>>();
  for (const share of db.contactShares ?? []) {
    const set = sharesByHousehold.get(share.householdId) ?? new Set<string>();
    set.add(share.bochurId);
    sharesByHousehold.set(share.householdId, set);
  }
  function isSharedWithBochurim(householdId: string) {
    if (!myBochurIds.length) return false;
    const set = sharesByHousehold.get(householdId) ?? new Set();
    return myBochurIds.every((id) => set.has(id));
  }
  const nameById = new Map(db.users.map((member) => [member.id, member.name]));
  const roleById = new Map(db.users.map((member) => [member.id, member.role]));
  function displayPersonName(id: string | null | undefined, fallback: string) {
    if (!id) return fallback;
    if ((user.role === "shliach" || user.role === "bochur") && (roleById.get(id) === "admin" || (!roleById.has(id) && id !== user.id))) {
      // Admins are hidden from shliach/bochur; RLS omits them, so an unknown author is shown as Cora.
      if (roleById.get(id) === "admin" || !roleById.has(id)) return "Cora";
    }
    return nameById.get(id) ?? fallback;
  }

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
      const editsContact = canEditContact(user, household.ownerId, db.users, today, household.sharedWithCora, household.state, household.city);
      const contactVisits = outreachFor(db, household).map((visit) => ({
        id: visit.id,
        visited: visit.visited,
        visitedBy: hideHistory ? null : (visit.visitedBy ?? null),
        reaction: hideHistory ? null : visit.reaction,
        notes: hideHistory ? "" : visit.notes,
        visitDate: visit.visitDate,
        status: visit.status,
        createdAt: visit.createdAt,
        createdBy: visit.createdBy,
        projectId: visit.projectId ?? household.projectId ?? null,
        activities: visit.activities ?? [],
        // Admin/editor may remove; shliach only with delete rights; bochur only his own visits for his project.
        canRemove: (() => {
          if (visit.id.startsWith("legacy-")) return editsContact && perms.canDeleteContacts;
          if (editsContact && perms.canDeleteContacts) return true;
          if (!(perms.canLogVisit && visit.createdBy === user.id)) return false;
          if (user.role === "bochur") {
            const visitProject = visit.projectId ?? household.projectId ?? null;
            return Boolean(user.projectId && visitProject && visitProject === user.projectId);
          }
          return true;
        })(),
        canEditVisit: (() => {
          if (visit.id.startsWith("legacy-")) return false;
          if (editsContact) return true;
          if (!(perms.canLogVisit && visit.createdBy === user.id)) return false;
          if (user.role === "bochur") {
            const visitProject = visit.projectId ?? household.projectId ?? null;
            return Boolean(user.projectId && visitProject && visitProject === user.projectId);
          }
          return true;
        })(),
      }));
      const latest = contactVisits[0] ?? null;
      const realVisits = contactVisits.filter((visit) => isRealVisit(visit.visited));
      const live = liveDups.get(household.id);
      const possibleDuplicate = Boolean(live);
      // Only name the other contact when this viewer is allowed to see it.
      const seenMatch = Boolean(live && (!allowed || allowed.has(live.matchId)));
      const duplicateMatchId = seenMatch && live ? live.matchId : null;
      const duplicateReason = !live ? "" : seenMatch ? live.reason : "Possible duplicate of another contact";
      const duplicateOfName = duplicateMatchId
        ? visibleHouseholds.find((item) => item.id === duplicateMatchId)?.name
          || db.people.find((person) => person.householdId === duplicateMatchId && person.name.trim())?.name
          || null
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
        extraAddresses: parseExtraAddresses(household.extraAddresses),
        notes: household.notes,
        projectId: household.projectId,
        projectName: project && isListedProject(project.name) ? projectLabel(project.name) : null,
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
        deletedAt: household.deletedAt ?? null,
        deletedByShliachAt: household.deletedByShliachAt ?? null,
        deletedByShliachBy: household.deletedByShliachBy ?? null,
        deletedByShliachName: household.deletedByShliachBy
          ? (user.role === "admin" ? (nameById.get(household.deletedByShliachBy) ?? "Shliach") : "Shliach")
          : null,
        sharedWithBochurim: isSharedWithBochurim(household.id),
        visitReaction: household.visitReaction,
        possibleDuplicate,
        duplicateOf: duplicateMatchId,
        duplicateOfName,
        duplicateMatchId,
        canMarkNotDuplicate: possibleDuplicate && canMarkNotDuplicate(user, household.ownerId, db.users, today, household.sharedWithCora, household.state, household.city),
        duplicateReason,
        contactVisits,
        latestVisited: realVisits[0]?.visited ?? "",
        latestReaction: latest?.reaction ?? null,
        visitCount: realVisits.length,
        createdAt: household.createdAt,
        importBatchId: household.importBatchId ?? null,
        createdBy: household.createdBy ?? null,
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
        visitorName: displayPersonName(visit.visitorId, visit.visitorName),
        visitDate: visit.visitDate,
        status: visit.status,
        reaction: hideHistory ? null : visit.reaction,
        details: hideHistory ? "" : visit.details,
        followUpDate: visit.followUpDate,
        scheduleName: household?.scheduleName ?? "None",
        categoryNames: household?.categoryNames ?? [],
        projectName: household?.projectName ?? null,
        createdAt: visit.createdAt,
        activities: visit.activities ?? [],
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
        projectName: projectLabel(db.projects.find((project) => project.id === route.projectId)?.name),
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
    visitorName: displayPersonName(visit.visitorId, visit.visitorName),
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

  const rosterMembers =
    user.role === "limited" || user.role === "bochur"
      ? []
      : user.role === "shliach"
        ? db.users.filter((member) => member.id === user.id || (member.role === "bochur" && member.leaderId === user.id))
        : db.users;
  const roster: TeamMember[] = rosterMembers.map((member) => ({
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
          avatarUrl: member.avatarUrl ?? null,
          territory: member.territory ?? [],
          adminApprovedAt: member.adminApprovedAt ?? null,
          finalApprovedAt: member.finalApprovedAt ?? null,
          projectId: member.projectId ?? null,
          kind: "member" as const,
          chavrusa: member.chavrusa === "A" || member.chavrusa === "B" ? member.chavrusa : null,
          hasSignedIn: member.status === "invited" ? false : member.hasSignedIn !== false,
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
        avatarUrl: null,
        territory: invite.territory ?? [],
        adminApprovedAt: null,
        finalApprovedAt: null,
        projectId: null,
        kind: "invite",
        chavrusa: null,
        hasSignedIn: false,
      });
    }
  }

  const activityCounts = activityCountsFor(
    db.contactVisits ?? [],
    visibleHouseholds,
    user,
    user.role === "bochur" && user.projectId ? { projectId: user.projectId } : undefined,
  );

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
      avatarUrl: user.avatarUrl ?? null,
      theme: user.theme ?? null,
      backgroundUrl: user.backgroundUrl ?? null,
      themeMatchPhoto: Boolean(user.themeMatchPhoto),
      themeColors: user.themeColors ?? null,
      shareNewWithBochurim: Boolean(user.shareNewWithBochurim),
      bochurimEditPlanner:
        user.role === "bochur"
          ? Boolean(db.users.find((member) => member.id === user.leaderId)?.bochurimEditPlanner)
          : Boolean(user.bochurimEditPlanner),
      bochurimSeePlannerDefault:
        user.role === "bochur"
          ? (db.users.find((member) => member.id === user.leaderId)?.bochurimSeePlannerDefault !== false)
          : user.bochurimSeePlannerDefault !== false,
      projectId: user.projectId ?? null,
      tutorialStep: user.tutorialStep ?? 0,
      tutorialDone: Boolean(user.tutorialDone),
      chavrusa: user.chavrusa === "A" || user.chavrusa === "B" ? user.chavrusa : null,
      territory: user.territory ?? [],
      preview: user.previewing
        ? { role: user.role === "bochur" ? "bochur" as const : "shliach" as const, state: user.territory?.[0]?.state ?? null }
        : null,
      ...perms,
    },
    org: db.organization,
    members: roster,
    projects: listedProjects(db.projects),
    categories: db.categories,
    customFields: db.customFields,
    outreachTemplates: db.outreachTemplates ?? [],
    outreachSenders: (db.outreachSenders ?? []).filter((item) => item.userId === user.id),
    outreachText: db.outreachText && db.outreachText.userId === user.id ? db.outreachText : null,
    preplannerEntries: (db.preplannerEntries ?? [])
      .filter((entry) => visibleIds.has(entry.householdId))
      .slice()
      .sort((a, b) => `${a.reachedDate || a.requestedDate}T${a.reachedTime || a.requestedTime}`.localeCompare(`${b.reachedDate || b.requestedDate}T${b.reachedTime || b.requestedTime}`) || a.createdAt.localeCompare(b.createdAt)),
    gmailAccounts: (db.gmailAccounts ?? []).filter((item) => item.userId === user.id),
    domainSenders: (db.domainSenders ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.email.localeCompare(b.email)),
    mailSetup: mailSetupStatus(),
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
      activityCounts,
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
