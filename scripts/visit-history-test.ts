import { present } from "../lib/present";
import type { Database, Household, User, Visit } from "../lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const user: User = {
  id: "u1",
  orgId: "o1",
  name: "Ada",
  email: "a@example.com",
  passwordHash: "",
  role: "admin",
  status: "approved",
  expiresAt: null,
  canViewHistory: true,
  canViewContact: true,
  canEdit: true,
  assignedRouteIds: [],
  leaderId: null,
  territory: [],
};

const household: Household = {
  id: "h1",
  orgId: "o1",
  name: "Sample",
  street: "",
  city: "Bangor",
  state: "ME",
  zip: "",
  country: "USA",
  lat: null,
  lng: null,
  notes: "",
  projectId: null,
  scheduleCategoryId: null,
  categoryIds: [],
  tags: [],
  customFields: {},
  sharedWithCora: true,
  ownerId: "u1",
  visitReaction: null,
  possibleDuplicate: false,
  duplicateOf: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const log: Visit = {
  id: "v1",
  orgId: "o1",
  householdId: "h1",
  visitorId: "u1",
  visitorName: "Ada",
  visitDate: "2026-11-03",
  status: "completed",
  reaction: "warm",
  details: "Brought a calendar",
  followUpDate: null,
  createdAt: "2026-11-03T15:00:00.000Z",
};

function database(patch: Partial<Database>): Database {
  return {
    version: 1,
    organization: {
      id: "o1",
      name: "Cora",
      chabadHouseName: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      country: "USA",
      lat: null,
      lng: null,
      startLat: null,
      startLng: null,
      defaultState: "",
      planName: "",
      planLimit: 1000,
      planRenewsOn: "",
    },
    users: [user],
    invites: [],
    projects: [],
    categories: [],
    customFields: [],
    households: [household],
    people: [],
    visits: [log],
    contactVisits: [],
    contactVisitsReady: true,
    routes: [],
    notifications: [],
    ...patch,
  };
}

const loggedOnly = present(database({}), user, "supabase", "2026-11-03");
const history = loggedOnly.households[0]?.contactVisits ?? [];
assert(history.some((visit) => visit.id === "v1" && visit.notes === "Brought a calendar"), "a logged visit shows in contact history");
assert(history.find((visit) => visit.id === "v1")?.reaction === "warm", "the logged reaction is kept");

const both = present(database({
  contactVisits: [{
    id: "v1",
    orgId: "o1",
    householdId: "h1",
    visited: "Summer 5786",
    reaction: "very_happy",
    notes: "From the visit row",
    visitDate: "2026-11-03",
    status: "completed",
    arrived: "",
    createdBy: "u1",
    createdAt: "2026-11-03T15:00:00.000Z",
    importBatchId: null,
  }],
}), user, "supabase", "2026-11-03");
const merged = both.households[0]?.contactVisits ?? [];
assert(merged.length === 1, "a log and a contact visit with the same id are one history row");
assert(merged[0]?.visited === "Summer 5786" && merged[0]?.reaction === "very_happy", "the contact visit keeps its season and reaction");

console.log("visit history ok");
