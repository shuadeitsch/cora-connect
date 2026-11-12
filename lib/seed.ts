import { OUTREACH_TEMPLATES } from "@/lib/outreach";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-accounts";
import { addDays, todayIso } from "@/lib/format";
import { TOWNS, geocodeAddress, nearestNeighbor } from "@/lib/geo";
import { stableId } from "@/lib/ids";
import { dueInfo } from "@/lib/model";
import { hashPassword } from "@/lib/password";
import type {
  Category,
  Database,
  Household,
  Person,
  Project,
  Reaction,
  Route,
  Visit,
  VisitStatus,
} from "@/lib/types";

const ORG_ID = stableId(1);

const HIM = [
  "Aaron", "David", "Yosef", "Moshe", "Shmuel", "Eli", "Jacob", "Isaac", "Benjamin", "Daniel",
  "Nathan", "Adam", "Caleb", "Ezra", "Jonah", "Asher", "Simon", "Reuben", "Gideon", "Micah",
];
const HER = [
  "Miriam", "Rachel", "Chana", "Leah", "Rivka", "Sara", "Esther", "Dinah", "Tova", "Maya",
  "Ayelet", "Shoshana", "Yael", "Noa", "Hadassah", "Ruth", "Naomi", "Talia", "Aviva", "Dina",
];
const LAST = [
  "Cohen", "Levi", "Goldberg", "Friedman", "Shapiro", "Rosenberg", "Kaplan", "Bernstein",
  "Schwartz", "Weiss", "Klein", "Horowitz", "Feldman", "Abramson", "Lieberman", "Katz",
  "Stern", "Blum", "Eisenberg", "Perlman", "Gross", "Hirsch", "Mandel", "Adler", "Berg",
  "Roth", "Siegel", "Frankel", "Weissman", "Navon",
];
const STREETS = [
  "Prairie Lane", "Cedar Ridge Road", "Cottonwood Drive", "River Bend Road", "Homestead Avenue",
  "Orchard Street", "Maple Court", "Wagon Trail", "Sunset Ridge", "Lakeview Drive", "Mill Road",
  "Aspen Way", "Frontier Street", "Meadow Loop", "Schoolhouse Lane", "Depot Street",
  "Hillcrest Drive", "North Pasture Road", "Quarry Road", "County Road 18",
];
const NOTES = [
  "Only Jewish family on this county road. They asked for a call before the next drive out.",
  "Left a challah and a short note. The porch light was on, nobody answered.",
  "Long porch conversation about the three-hour drive to the nearest Hebrew school.",
  "They winter out of state and asked for a visit after Passover.",
  "Kids at home. Parents want a mezuzah checked before the next holiday.",
  "Ranch gate sticks; call from the highway turnout and someone will open it.",
  "Warm visit. They have cousins in Chicago and go there for the high holidays.",
  "Not home. Honey jar and a card left inside the storm door.",
  "Asked not to be on the weekday route. Sunday afternoon is better.",
  "New in town this year, still unpacking. Follow up with a Shabbat time.",
];
const VISIT_NOTES = [
  "Talked on the steps for a few minutes. They were glad somebody made the drive.",
  "Deferred — the gravel road was closed after last night's snow.",
  "Studied briefly at the kitchen table. They asked for a holiday calendar.",
  "Nobody home. Left a card with the Cora phone number.",
  "Friendly visit. They want help affixing a mezuzah next time a rabbi is nearby.",
  "Short conversation. They are not interested in a regular visit this season.",
  "Brought honey. They mentioned a student boarding in town for the semester.",
  "Phone follow-up from the highway. They asked us to come back in two weeks.",
];
const HEBREW = ["Chaim", "Moshe Dovid", "Rivka Leah", "Shaina", "Yitzchak", "Menachem", "Bracha", "Eliyahu"];
const TIMES = ["Morning", "Afternoon", "Evening", "Sunday only"];
const TAGS = ["ranch", "shabbat", "kids", "snowbird", "new", "student"];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
}

export function buildSeed(now = new Date()): Database {
  const today = todayIso(now);
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const projects: Project[] = [
    { id: stableId(201), orgId: ORG_ID, name: "Summer Circuit 2026" },
    { id: stableId(202), orgId: ORG_ID, name: "High Holiday Honey" },
    { id: stableId(203), orgId: ORG_ID, name: "Unsorted Routes" },
  ];

  const categories: Category[] = [
    { id: stableId(301), orgId: ORG_ID, name: "None", kind: "scheduled", intervalDays: null },
    { id: stableId(302), orgId: ORG_ID, name: "Monthly", kind: "scheduled", intervalDays: 30 },
    { id: stableId(303), orgId: ORG_ID, name: "Bi-Monthly", kind: "scheduled", intervalDays: 60 },
    { id: stableId(304), orgId: ORG_ID, name: "Quarterly", kind: "scheduled", intervalDays: 90 },
    { id: stableId(305), orgId: ORG_ID, name: "Twice a year", kind: "scheduled", intervalDays: 180 },
    { id: stableId(306), orgId: ORG_ID, name: "Yearly", kind: "scheduled", intervalDays: 365 },
    { id: stableId(311), orgId: ORG_ID, name: "New", kind: "regular", intervalDays: null },
    { id: stableId(312), orgId: ORG_ID, name: "Challah", kind: "regular", intervalDays: null },
    { id: stableId(313), orgId: ORG_ID, name: "Honey", kind: "regular", intervalDays: null },
    { id: stableId(314), orgId: ORG_ID, name: "Mezuzah", kind: "regular", intervalDays: null },
    { id: stableId(315), orgId: ORG_ID, name: "Student", kind: "regular", intervalDays: null },
    { id: stableId(316), orgId: ORG_ID, name: "Moved away", kind: "regular", intervalDays: null },
    { id: stableId(317), orgId: ORG_ID, name: "Isolated family", kind: "regular", intervalDays: null },
  ];
  const noneId = stableId(301);
  const biMonthly = stableId(303);

  const households: Household[] = [];
  const people: Person[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < 72; i++) {
    const town = TOWNS[i % TOWNS.length]!;
    const last = LAST[i % LAST.length]!;
    const him = HIM[i % HIM.length]!;
    const her = HER[(i * 3) % HER.length]!;
    const pattern = i % 6;
    let name = "";
    const members: { name: string; gender: "him" | "her" }[] = [];
    if (pattern === 0) {
      name = `Mr. & Mrs. ${him} ${last}`;
      members.push({ name: `${him} ${last}`, gender: "him" }, { name: `${her} ${last}`, gender: "her" });
    } else if (pattern === 1) {
      const female = i % 2 === 0;
      name = `Dr. ${female ? her : him} ${last}`;
      members.push(female ? { name: `${her} ${last}`, gender: "her" } : { name: `${him} ${last}`, gender: "him" });
    } else if (pattern === 2) {
      name = `The ${last} Family`;
      members.push(
        { name: `${him} ${last}`, gender: "him" },
        { name: `${her} ${last}`, gender: "her" },
      );
      if (i % 4 === 0) members.push({ name: `${HIM[(i + 5) % HIM.length]} ${last}`, gender: "him" });
    } else if (pattern === 3) {
      name = `Ms. ${her} ${last}`;
      members.push({ name: `${her} ${last}`, gender: "her" });
    } else if (pattern === 4) {
      name = `Mr. ${him} ${last}`;
      members.push({ name: `${him} ${last}`, gender: "him" });
    } else {
      name = `${him} & ${her} ${last}`;
      members.push({ name: `${him} ${last}`, gender: "him" }, { name: `${her} ${last}`, gender: "her" });
    }
    if (usedNames.has(name)) name = `${name} (${town.city})`;
    usedNames.add(name);

    const streetNo = 120 + ((i * 37) % 8600);
    const street = `${streetNo} ${STREETS[i % STREETS.length]}`;
    const point = geocodeAddress(town.city, town.state, street)!;
    const scheduleCategoryId =
      i % 10 === 0 ? noneId : i % 5 === 0 ? stableId(304) : i % 3 === 0 ? stableId(302) : biMonthly;
    if (i % 11 === 0) {
      // yearly / twice a year sprinkled in
    }
    const chosenSchedule =
      i % 17 === 0 ? stableId(306) : i % 13 === 0 ? stableId(305) : scheduleCategoryId;
    const categoryIds = [stableId(311)];
    if (i % 4 === 0) categoryIds.push(stableId(312));
    if (i % 5 === 0) categoryIds.push(stableId(313));
    if (i % 6 === 0) categoryIds.push(stableId(314));
    if (i % 9 === 0) categoryIds.push(stableId(315));
    if (i % 15 === 0) categoryIds.push(stableId(317));
    const projectId = i % 5 === 0 ? projects[2]!.id : i % 2 === 0 ? projects[0]!.id : projects[1]!.id;
    const createdAt =
      i < 6 ? `${today.slice(0, 8)}${String(3 + i).padStart(2, "0")}T15:00:00.000Z` : addDays(today, -30 - (i % 300)) + "T15:00:00.000Z";
    const id = stableId(1000 + i);
    const tags: string[] = [];
    if (i % 3 === 0) tags.push(TAGS[i % TAGS.length]!);
    if (i % 7 === 0) tags.push("kids");

    households.push({
      id,
      orgId: ORG_ID,
      name,
      street,
      city: town.city,
      state: town.state,
      zip: town.zip,
      country: "USA",
      lat: point.lat,
      lng: point.lng,
      notes: i % 3 === 0 ? NOTES[i % NOTES.length]! : "",
      projectId,
      scheduleCategoryId: chosenSchedule,
      categoryIds: [...new Set(categoryIds)],
      tags,
      sharedWithCora: true,
      ownerId: null,
      visitReaction: i % 5 === 0 ? "very_happy" : i % 5 === 1 ? "warm" : i % 5 === 2 ? "neutral" : i % 5 === 3 ? "cold" : "very_cold",
      extraAddresses: [],
      possibleDuplicate: false,
      duplicateOf: null,
      customFields: {
        [stableId(401)]: i % 2 === 0 ? HEBREW[i % HEBREW.length]! : "",
        [stableId(402)]: TIMES[i % TIMES.length]!,
        [stableId(403)]: String(1994 + (i % 30)),
      },
      createdAt,
    });

    members.forEach((member, index) => {
      const phoneN = (i * 3 + index) % 100;
      const hidePhone = i % 11 === 0 && index === 0;
      const hideEmail = i % 8 === 0;
      const phone = hidePhone ? "" : `(${town.area}) 555-01${String(phoneN).padStart(2, "0")}`;
      people.push({
        id: stableId(5000 + i * 4 + index),
        householdId: id,
        name: member.name,
        gender: member.gender,
        phone,
        phone2: "",
        phone3: "",
        email: hideEmail ? "" : `${slug(member.name)}.${i}@example.com`,
        whatsapp: hidePhone || i % 4 === 0 ? "" : phone,
        sortOrder: index,
      });
    });
  }

  // A few households explicitly marked moved, with no schedule.
  for (const index of [14, 33, 51]) {
    const household = households[index];
    if (!household) continue;
    household.scheduleCategoryId = noneId;
    if (!household.categoryIds.includes(stableId(316))) household.categoryIds.push(stableId(316));
  }

  const visitors = DEMO_USERS.filter((user) => user.role !== "limited");
  const visits: Visit[] = [];
  let visitN = 0;
  const pushVisit = (
    householdIndex: number,
    daysAgo: number,
    status: VisitStatus,
    reaction: Reaction | null,
  ) => {
    const household = households[householdIndex];
    if (!household) return;
    const visitor = visitors[visitN % visitors.length]!;
    const follow = status === "deferred" && visitN % 2 === 0 ? addDays(today, 14) : null;
    visits.push({
      id: stableId(8000 + visitN),
      orgId: ORG_ID,
      householdId: household.id,
      visitorId: stableId(visitor.key),
      visitorName: visitor.name,
      visitDate: addDays(today, -daysAgo),
      status,
      reaction: status === "completed" ? reaction : reaction,
      details: VISIT_NOTES[visitN % VISIT_NOTES.length]!,
      followUpDate: follow,
      createdAt: addDays(today, -daysAgo) + "T18:00:00.000Z",
    });
    visitN += 1;
  };

  households.forEach((_, i) => {
    if (i % 3 === 0) return;
    const reactions: Reaction[] = ["happy", "warm", "warm", "neutral", "cold", "not_interested", "happy"];
    pushVisit(i, 20 + (i % 50), i % 7 === 0 ? "deferred" : "completed", reactions[i % reactions.length]!);
    if (i % 4 === 0) pushVisit(i, 80 + (i % 20), "completed", "warm");
  });

  // Guarantee an overdue set, a due-this-week set, and visits inside the current month.
  const biMonthlyHouseholds = households
    .map((household, index) => ({ household, index }))
    .filter((row) => row.household.scheduleCategoryId === biMonthly);
  biMonthlyHouseholds.slice(0, 8).forEach((row, n) => {
    visits
      .filter((visit) => visit.householdId === row.household.id)
      .forEach((visit) => {
        visit.status = "completed";
        visit.visitDate = addDays(today, -70 - n);
        visit.reaction = "warm";
      });
    if (!visits.some((visit) => visit.householdId === row.household.id)) {
      pushVisit(row.index, 72, "completed", "warm");
    }
  });
  biMonthlyHouseholds.slice(8, 14).forEach((row) => {
    const existing = visits.filter((visit) => visit.householdId === row.household.id);
    if (existing.length) {
      const latest = existing.sort((a, b) => b.visitDate.localeCompare(a.visitDate))[0]!;
      latest.status = "completed";
      latest.visitDate = addDays(today, -56);
      latest.reaction = "happy";
    } else {
      pushVisit(row.index, 56, "completed", "happy");
    }
  });
  [1, 2, 4, 5, 7, 8, 10, 11, 13, 16].forEach((index, n) => {
    pushVisit(index, [1, 2, 3, 4, 6, 8, 9, 11, 12, 15][n] ?? 2, "completed", n % 2 ? "warm" : "happy");
  });

  const users = DEMO_USERS.map((account) => ({
    id: stableId(account.key),
    orgId: ORG_ID,
    name: account.name,
    email: account.email,
    passwordHash,
    role: account.role,
    status: "approved" as const,
    expiresAt: account.expiresInDays == null ? null : addDays(today, account.expiresInDays),
    canViewHistory: account.canViewHistory,
    canViewContact: account.canViewContact,
    canEdit: account.canEdit,
    assignedRouteIds: [] as string[],
    leaderId: null,
    territory: [],
  }));

  const byState = (state: string) =>
    households.filter((household) => household.state === state).map((household) => household.id);

  const routeDefs: { key: number; name: string; projectId: string; ids: string[]; optimized: boolean }[] = [
    { key: 901, name: "Gallatin Valley", projectId: projects[0]!.id, ids: byState("MT").slice(0, 8), optimized: true },
    { key: 902, name: "Hi-Line", projectId: projects[0]!.id, ids: byState("MT").slice(4, 11), optimized: true },
    { key: 903, name: "Moosehead", projectId: projects[1]!.id, ids: byState("ME").slice(0, 7), optimized: true },
    { key: 904, name: "Prairie Shabbat", projectId: projects[1]!.id, ids: [...byState("ND").slice(0, 4), ...byState("SD").slice(0, 4)], optimized: true },
    { key: 905, name: "High Plains", projectId: projects[0]!.id, ids: [...byState("WY").slice(0, 4), ...byState("NE").slice(0, 3)], optimized: false },
    { key: 906, name: "Capitol Region", projectId: projects[2]!.id, ids: [...byState("VT"), ...byState("NH")].slice(0, 8), optimized: true },
    { key: 907, name: "Snake River", projectId: projects[2]!.id, ids: byState("ID"), optimized: false },
    { key: 908, name: "Rio Grande", projectId: projects[1]!.id, ids: byState("NM"), optimized: false },
  ];

  const start = { lat: 45.677, lng: -111.0429 };
  const routes: Route[] = routeDefs.map((def) => {
    const points = def.ids.map((id) => {
      const household = households.find((item) => item.id === id)!;
      return { id, lat: household.lat, lng: household.lng };
    });
    const ordered = def.optimized ? nearestNeighbor(start, points) : def.ids;
    return {
      id: stableId(def.key),
      orgId: ORG_ID,
      name: def.name,
      projectId: def.projectId,
      optimized: def.optimized,
      createdBy: stableId(101),
      createdAt: addDays(today, -((def.key % 20) + 3)) + "T16:00:00.000Z",
      stops: ordered.map((householdId, position) => ({ householdId, position })),
    };
  });

  for (const account of DEMO_USERS) {
    if (account.routeSlot == null) continue;
    const route = routes[account.routeSlot];
    const user = users.find((item) => item.id === stableId(account.key));
    if (route && user) user.assignedRouteIds = [route.id];
  }

  const overdue = households.filter((household) => {
    const category = categories.find((item) => item.id === household.scheduleCategoryId);
    const info = dueInfo(
      category?.intervalDays ?? null,
      household.createdAt,
      visits.filter((visit) => visit.householdId === household.id),
      today,
    );
    return info.dueState === "overdue";
  }).length;

  return {
    version: 1,
    organization: {
      id: ORG_ID,
      name: "Chabad Outreach to Rural America",
      chabadHouseName: "Cora House",
      street: "120 Prairie Lane",
      city: "Bozeman",
      state: "MT",
      zip: "59715",
      country: "USA",
      lat: 45.6791,
      lng: -111.0388,
      startLat: 45.6791,
      startLng: -111.0388,
      defaultState: "",
      planName: "Up to 1,000 — Year-Round",
      planLimit: 1000,
      planRenewsOn: addDays(today, 180),
    },
    users,
    invites: [],
    projects,
    categories,
    outreachSenders: [],
    outreachText: null,
    outreachTemplates: OUTREACH_TEMPLATES.map((item, index) => ({
      ...item,
      orgId: ORG_ID,
      sortOrder: index + 1,
    })),
    customFields: [
      { id: stableId(401), orgId: ORG_ID, name: "Hebrew name", fieldType: "text", options: [] },
      {
        id: stableId(402),
        orgId: ORG_ID,
        name: "Best time to visit",
        fieldType: "select",
        options: ["Morning", "Afternoon", "Evening", "Sunday only"],
      },
      { id: stableId(403), orgId: ORG_ID, name: "Year arrived", fieldType: "number", options: [] },
    ],
    households,
    people,
    visits,
    contactVisits: [],
    contactVisitsReady: false,
    routes,
    notifications: [
      {
        id: stableId(9501),
        orgId: ORG_ID,
        title: "Households are overdue",
        body: `${overdue} households are past their visit interval. Open Contacts and turn on Requires attention.`,
        createdAt: addDays(today, -1) + "T14:00:00.000Z",
        readBy: [],
      },
      {
        id: stableId(9502),
        orgId: ORG_ID,
        title: "Gallatin Valley is ready",
        body: "The Gallatin Valley route is saved and ordered from the Bozeman start point.",
        createdAt: addDays(today, -2) + "T14:00:00.000Z",
        readBy: [],
      },
      {
        id: stableId(9503),
        orgId: ORG_ID,
        title: "An access date passed",
        body: "Chana Hirsch's visitor access has expired. Renew it from My Team if she is still driving.",
        createdAt: addDays(today, -3) + "T14:00:00.000Z",
        readBy: [],
      },
      {
        id: stableId(9504),
        orgId: ORG_ID,
        title: "Honey route this week",
        body: "High Holiday Honey still has households due in the next seven days.",
        createdAt: today + "T13:00:00.000Z",
        readBy: [],
      },
    ],
  };
}

export const SEED_ORG_ID = ORG_ID;
