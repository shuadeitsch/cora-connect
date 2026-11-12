import { VISIT_ACTIVITIES, normalizeActivity, sameActivity } from "../lib/constants";
import { activityCountsFor } from "../lib/visit-activities";
import type { ContactVisit, Household, User } from "../lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(VISIT_ACTIVITIES.join("|") === "Nice conversation|Tefillin|Shabbos candles|Menorah|Package|Challah|Mezuzah", "official chips stay in Mendel's order");
assert(!(VISIT_ACTIVITIES as readonly string[]).includes("Shofar"), "Shofar is not a default chip");
assert(!(VISIT_ACTIVITIES as readonly string[]).includes("Matzah"), "Matzah is not a default chip");
assert(normalizeActivity("put on tefillin") === "Tefillin", "older Put on tefillin wording maps to Tefillin");
assert(sameActivity("Tefillin", "put on tefillin"), "alias matches the official chip");
assert(normalizeActivity("gave a package") === "Package", "Gave a package maps to Package");
assert(normalizeActivity("chanukah menorah") === "Menorah", "Chanukah menorah maps to Menorah");
assert(normalizeActivity("  Nice conversation  ") === "Nice conversation", "trims a known chip");
assert(normalizeActivity("Brought soup") === "Brought soup", "unknown text is not turned into a chip");
assert(normalizeActivity("") === "", "blank stays blank");

const household: Household = {
  id: "h1",
  orgId: "o1",
  name: "Ada",
  street: "1 Main",
  city: "York",
  state: "ME",
  zip: "03909",
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

const viewer = { id: "u1", orgId: "o1", role: "admin" } as User;

function visit(activities: string[], patch: Partial<ContactVisit> = {}): ContactVisit {
  return {
    id: "v1",
    orgId: "o1",
    householdId: "h1",
    visited: "Summer 5786",
    reaction: null,
    notes: "",
    visitDate: "2026-08-01",
    status: "completed",
    arrived: "",
    createdBy: "u1",
    createdAt: "2026-08-01T00:00:00.000Z",
    importBatchId: null,
    activities,
    ...patch,
  };
}

const counted = activityCountsFor([visit(["put on tefillin", "Brought soup"])], [household], viewer);
assert(counted.find((row) => row.label === "Tefillin")?.count === 1, "older Tefillin wording counts under Tefillin");
assert(!counted.some((row) => row.label === "Other" || row.kind === "writein"), "there is no Other total");
assert(counted.find((row) => row.label === "Total")?.count === 1, "Total is only the official chips");
assert(counted.find((row) => row.label === "Mezuzah")?.count === 0, "unused chips still appear at zero");

const tagged = { ...household, tags: ["Not Jewish"] };
const skipped = activityCountsFor([visit(["Tefillin"])], [tagged], viewer);
assert(skipped.find((row) => row.label === "Tefillin")?.count === 0, "removed contacts are not counted");

const deferred = activityCountsFor([visit(["Tefillin"], { status: "deferred" })], [household], viewer);
assert(deferred.find((row) => row.label === "Tefillin")?.count === 0, "deferred visits are not counted");

console.log("visit activities ok");
