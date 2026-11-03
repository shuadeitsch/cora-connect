import { canonicalImportMap, guessImportMap, IMPORT_TEMPLATE_CSV, mapContacts } from "../lib/csv";
import { matchesTagFilter, parseContactTags, showInContactList, taggedAlongRoute } from "../lib/contact-tags";
import { parseHouseholdReaction } from "../lib/constants";
import { planImport } from "../lib/import-plan";
import { parseVisitStatus } from "../lib/visit-status";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const template = IMPORT_TEMPLATE_CSV.split("\n")[0]!.split(",");
assert(!template.includes("share_with_cora"), "the template has no share column");
assert(template.includes("tags") && template.includes("status"), "the template has tags and status");
const mapped = canonicalImportMap(template);
assert(mapped?.tags === "tags" && mapped.status === "status" && mapped.share === "", "the new header maps itself");

const old = "name,phone,email,address,city,state,zip,share_with_cora,visited,reaction,notes,visit_date".split(",");
const oldMap = canonicalImportMap(old);
assert(oldMap?.share === "share_with_cora" && oldMap.visited === "visited", "an old file with share_with_cora still maps");

const parsed = mapContacts(
  "name,tags,status,visited\nAda,not jewish; Probably doesn't exist,nope,Summer 5786\n",
  { ...mapped!, name: "name", tags: "tags", status: "status", visited: "visited" },
);
assert(parsed.contacts[0]?.warnings.some((warning) => warning.includes("Completed")), "an unrecognized status becomes Completed");
assert(parseContactTags("not jewish; Probably doesn't exist").tags.join("|") === "Not Jewish|Probably doesn't exist", "tags ignore case and accept semicolons");
assert(parseContactTags("probobly dosent exist").tags[0] === "Probably doesn't exist", "a misspelled existence tag is the official tag");
assert(parseContactTags("Probably doesn’t exist").tags[0] === "Probably doesn't exist", "a curly apostrophe still matches");
assert(parseContactTags("Probably doesnt exist").tags[0] === "Probably doesn't exist", "a missing apostrophe still matches");
assert(parseContactTags("PROBABLY DOES NOT EXIST").tags[0] === "Probably doesn't exist", "does not exist still matches");
assert(showInContactList(["probobly dosent exist"], "", "tagged"), "the tagged filter includes the misspelled tag");
assert(showInContactList(["Probably doesn’t exist"], "", "main") === false, "a curly-apostrophe tag stays off the main list");
assert(parseContactTags("friend").unknown[0] === "friend", "an unknown tag is reported");
assert(parseVisitStatus("").status === "completed", "a blank status is Completed");
assert(parseVisitStatus("Deferred").status === "deferred", "Deferred is deferred");

assert(!showInContactList(["Not Jewish"], "", "main"), "tagged contacts stay off the main list");
assert(showInContactList(["Not Jewish"], "ada", "main"), "search still finds a tagged contact");
assert(showInContactList(["Not Jewish"], "", "tagged"), "the tagged section shows them");
assert(!showInContactList([], "", "tagged"), "an untagged contact is not in the tagged section");

const near = taggedAlongRoute(
  [
    { id: "1", name: "On route", city: "Bangor", state: "ME", tags: ["Not Jewish"] },
    { id: "2", name: "Same town", city: "Bangor", state: "ME", tags: ["Probably doesn't exist"] },
    { id: "3", name: "Other town", city: "Augusta", state: "ME", tags: ["Not Jewish"] },
    { id: "4", name: "No town", city: "", state: "ME", tags: ["Not Jewish"] },
    { id: "5", name: "Plain", city: "Bangor", state: "ME", tags: [] },
  ],
  [{ householdId: "1", city: "Bangor", state: "ME" }],
);
assert(near.map((item) => item.name).join("|") === "No town|On route|Same town", "the route notice is the stop, the same town, and a stateless contact in that state");

const maineHeaders = ["Name", "Phone", "Reactions", "Visited", "Notes"];
const maineMap = guessImportMap(maineHeaders);
assert(maineMap.visitReaction === "Reactions", "a Reactions column maps onto the visit reaction");
assert(maineMap.visited === "Visited", "Visited is not stolen by the reaction column");
assert(guessImportMap(["Visit reaction"]) .visitReaction === "Visit reaction", "Visit reaction stays the reaction column");
assert(guessImportMap(["Reaction:"]) .visitReaction === "Reaction:", "a Reaction header with punctuation still maps");

const maineCsv = "Name,Phone,Reactions,Visited,Notes\nAda,207-555-0100,Very cold / angry,Summer 5786,Brought a calendar\n";
const maineRows = mapContacts(maineCsv, { ...maineMap, name: "Name", phone: "Phone", visitReaction: maineMap.visitReaction, visited: "Visited", notes: "Notes" });
assert(maineRows.contacts[0]?.reaction === "Very cold / angry", "the Reactions cell is kept on the row");
const mainePlan = planImport(maineRows.contacts.map((row) => ({ ...row, shareWithCora: null })), []);
assert(mainePlan.contacts[0]?.visits[0]?.reaction === "very_cold", "Very cold / angry is stored on that visit");

for (const [label, id] of [
  ["VERY HAPPY", "very_happy"],
  ["very  happy", "very_happy"],
  ["Very cold/angry", "very_cold"],
  ["Very cold / angry", "very_cold"],
  ["  Cold ", "cold"],
  ["Warm", "warm"],
  ["NEUTRAL", "neutral"],
  ["Neutral (nisht ahin nisht aher)", "neutral"],
] as const) {
  assert(parseHouseholdReaction(label) === id, `${label} maps to ${id}`);
}

assert(matchesTagFilter(["Probably doesn't exist"], "Probably doesn't exist"), "the tag filter includes Probably doesn't exist");
assert(matchesTagFilter(["Not Jewish"], "Probably doesn't exist") === false, "a different tag does not match");
assert(matchesTagFilter(["Probably doesn’t exist"], "Probably doesn't exist"), "a curly apostrophe still matches the tag filter");
assert(matchesTagFilter([], "") === true, "an empty tag filter matches every contact");

console.log("import format ok");
