import { appendUniqueAddress, parseExtraAddresses, sameAddress } from "../lib/extra-addresses";
import { keepLostMergeValues } from "../lib/merge-keep";
import type { ContactSnapshot, Household, Person } from "../lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(parseExtraAddresses([{ street: "138 New County Rd", city: "Saco", state: "ME", zip: "04072", label: "Home" }]).length === 1, "parses a list");
assert(parseExtraAddresses("nope").length === 0, "ignores junk");
assert(sameAddress({ street: "469 Elm St Ste 3", city: "Biddeford", state: "ME", zip: "04005-4141" }, { street: "469 Elm St Ste 3", city: "Biddeford", state: "Maine", zip: "04005" }), "same address ignores state spelling and ZIP+4");

const extras = appendUniqueAddress([], { street: "10 Oak St", city: "York", state: "ME", zip: "03909", label: "Home" }, { street: "10 Oak St", city: "York", state: "ME", zip: "03909" });
assert(extras.length === 0, "does not add the main address again");
const added = appendUniqueAddress([], { street: "469 Elm St Ste 3", city: "Biddeford", state: "ME", zip: "04005", label: "Business" }, { street: "138 New County Rd", city: "Saco", state: "ME", zip: "04072" });
assert(added.length === 1 && added[0]?.label === "Business", "appends a different address");

function household(id: string, name: string, patch: Partial<Household> = {}): Household {
  return {
    id,
    orgId: "o1",
    name,
    street: "1 Main St",
    city: "York",
    state: "ME",
    zip: "03909",
    country: "USA",
    lat: null,
    lng: null,
    extraAddresses: [],
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
    ...patch,
  };
}

function person(householdId: string, patch: Partial<Person> = {}): Person {
  return { id: `${householdId}-p`, householdId, name: "Pat", gender: null, phone: "", phone2: "", phone3: "", email: "", whatsapp: "", sortOrder: 0, ...patch };
}

function snap(item: Household, people: Person[] = []): ContactSnapshot {
  return { household: item, people, contactVisits: [], visits: [] };
}

const source = snap(
  household("a", "Ann", { street: "469 Elm St Ste 3", city: "Biddeford", zip: "04005", notes: "Tile shop note" }),
  [person("a", { phone: "207-555-0100", email: "ann@example.com" })],
);
const target = snap(household("b", "Ann", { street: "138 New County Rd", city: "Saco", zip: "04072" }), [person("b")]);
const kept = keepLostMergeValues(source, target);
assert(kept.restored.includes("address") && kept.household.extraAddresses?.[0]?.street === "469 Elm St Ste 3", "keeps the other address");
assert(kept.restored.includes("phone") && kept.people[0]?.phone.includes("555-0100"), "fills an empty phone");
assert(kept.restored.includes("email") && kept.people[0]?.email === "ann@example.com", "fills an empty email");
assert(kept.restored.includes("notes") && kept.household.notes.includes("Tile shop note"), "appends notes");

const same = keepLostMergeValues(source, source);
assert(same.restored.length === 0, "identical values are not copied again");

const withPhone = keepLostMergeValues(
  snap(household("a", "Ann"), [person("a", { phone: "207-555-0100" })]),
  snap(household("b", "Ann"), [person("b", { phone: "207-555-0100" })]),
);
assert(!withPhone.restored.includes("phone"), "does not overwrite or duplicate a phone");


const tagged = keepLostMergeValues(
  snap(household("a", "Source", { tags: ["Not Jewish", "Probably doesn't exist"] })),
  snap(household("b", "Target")),
);
assert(tagged.restored.includes("tags"), "reports that tags were kept");
assert(tagged.household.tags.includes("Not Jewish"), "keeps Not Jewish");
assert(tagged.household.tags.includes("Probably doesn't exist"), "keeps Probably doesn't exist");

const alreadyTagged = keepLostMergeValues(
  snap(household("a", "Source", { tags: ["Not Jewish"] })),
  snap(household("b", "Target", { tags: ["Not Jewish"] })),
);
assert(!alreadyTagged.restored.includes("tags"), "does not duplicate a tag the survivor already has");
assert(alreadyTagged.household.tags.filter((tag) => tag === "Not Jewish").length === 1, "Not Jewish stays once");

const unionTags = keepLostMergeValues(
  snap(household("a", "Source", { tags: ["Probably doesn't exist"] })),
  snap(household("b", "Target", { tags: ["Not Jewish"] })),
);
assert(unionTags.household.tags.includes("Not Jewish") && unionTags.household.tags.includes("Probably doesn't exist"), "unions different tags from both cards");
assert(unionTags.restored.includes("tags"), "reports the added tag");

console.log("extra addresses and merge-keep ok");
