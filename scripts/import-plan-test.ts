import { importWrites, planImport, type ImportRow } from "../lib/import-plan";

function row(patch: Partial<ImportRow> = {}): ImportRow {
  return {
    name: "Sample Contact",
    phone: "207-555-0148",
    email: "sample.contact@example.com",
    street: "12 Harbor Rd",
    city: "Bangor",
    state: "ME",
    zip: "04401",
    shareWithCora: true,
    tags: "",
    visited: "",
    status: "",
    reaction: "",
    notes: "",
    visitDate: "",
    ...patch,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const differentVisited = planImport([
  row({ visited: "Summer 5786", reaction: "Warm", notes: "Calendar" }),
  row({ visited: "Chanukah 5787", reaction: "Neutral", notes: "Menorah" }),
], []);
assert(differentVisited.rowsRead === 2, "two rows read");
assert(differentVisited.created === 1, "one contact for two visits");
assert(differentVisited.visitsMerged === 1, "one visit merged");
assert(differentVisited.created + differentVisited.visitsMerged === differentVisited.rowsRead, "equation");
assert(differentVisited.contacts[0]?.visits.length === 2, "both visits kept");

const exact = planImport([
  row({ visited: "Summer 5786", notes: "Calendar" }),
  row({ visited: "Summer 5786", notes: "Calendar" }),
], []);
assert(exact.created === 2 && exact.visitsMerged === 0, "exact duplicate is its own contact");
assert(exact.possible === 1 && exact.contacts[1]?.duplicateReason === "Exact duplicate row", "exact row flagged");
assert(exact.created + exact.visitsMerged === exact.rowsRead, "exact equation");

const sameVisited = planImport([
  row({ visited: "Summer 5786", notes: "First" }),
  row({ visited: "Summer 5786", notes: "Second" }),
], []);
assert(sameVisited.created === 2, "same visited stays a contact");
assert(sameVisited.contacts[1]?.duplicateReason === "Same person and the same Visited value", "same visited flagged");

const loose = planImport([
  row({ name: "Sample Contact", phone: "207-555-0148", visited: "Summer 5786" }),
  row({ name: "Sample Contact", phone: "207-555-0199", email: "", visited: "Summer 5786" }),
  row({ name: "Sample Contakt", phone: "406-555-0100", email: "other@example.com", visited: "Chanukah 5787" }),
], []);
assert(loose.created === 3 && loose.visitsMerged === 0, "loose rows are not merged");
assert(loose.contacts.filter((contact) => contact.possibleDuplicate).length === 2, "loose rows flagged");

const ontoExisting = planImport(
  [row({ visited: "Chanukah 5787" }), row({ visited: "Summer 5786" })],
  [{ id: "existing", name: "Sample Contact", phone: "207-555-0148", email: "sample.contact@example.com", visited: ["Summer 5786"] }],
);
assert(ontoExisting.created === 1, "same visited against an existing contact is created");
assert(ontoExisting.visitsMerged === 1, "different visited merges onto the existing contact");
assert(ontoExisting.created + ontoExisting.visitsMerged === ontoExisting.rowsRead, "existing equation");
assert(ontoExisting.contacts.some((contact) => contact.existingId === "existing"), "merge target kept");

const filled = planImport([
  row({ visited: "Summer 5786", reaction: "N/A", notes: "" }),
  row({ visited: "Summer 5786", reaction: "Happy", notes: "Happy for the visit" }),
], []);
assert(filled.contacts[0]?.visits[0]?.reaction === "very_happy", "a later row fills a blank reaction on the same visit");
assert(filled.contacts[1]?.visits[0]?.reaction === "very_happy", "the duplicate row keeps its reaction");
assert(!filled.warnings.some((warning) => warning.includes("N/A")), "N/A is an empty reaction, not an error");
assert(planImport([row({ reaction: "Not interested", visited: "Summer 5786" })], []).contacts[0]?.visits[0]?.reaction === "very_cold", "Not interested maps to Very cold");

const unnamed = planImport([row({ name: "", phone: "", email: "", visited: "Summer 5786" })], []);
assert(unnamed.rowsRead === 1 && unnamed.created === 1, "a nameless row is still imported");

function assertDuplicateLinks(label: string, contacts: ReturnType<typeof planImport>["contacts"], existingIds: string[] = []) {
  const writes = importWrites(contacts, existingIds);
  const ready = new Set(existingIds);
  for (const write of writes) {
    if (write.duplicateOf) assert(ready.has(write.duplicateOf), `${label}: duplicate_of is inserted first`);
    assert(write.id === write.contact.id, `${label}: the inserted id is the planned id`);
    ready.add(write.id);
  }
}

assertDuplicateLinks("exact", exact.contacts);
assert(importWrites(exact.contacts, [])[1]?.duplicateOf === exact.contacts[0]?.id, "exact duplicate points at the first row");
assertDuplicateLinks("reversed exact", [exact.contacts[1]!, exact.contacts[0]!]);
assert(importWrites([exact.contacts[1]!, exact.contacts[0]!], [])[0]?.duplicateOf == null, "original is written before the duplicate");
assertDuplicateLinks("same visited", sameVisited.contacts);
assertDuplicateLinks("loose", loose.contacts);
assertDuplicateLinks("onto existing", ontoExisting.contacts, ["existing"]);

const chained = planImport([
  row({ visited: "Summer 5786", notes: "Calendar" }),
  row({ visited: "Summer 5786", notes: "Calendar" }),
  row({ visited: "Summer 5786", notes: "Calendar" }),
], []);
assert(chained.created === 3 && chained.visitsMerged === 0, "three exact rows are three contacts");
assertDuplicateLinks("chain", [...chained.contacts].reverse());
const chainWrites = importWrites([...chained.contacts].reverse(), []);
assert(chainWrites.filter((write) => write.duplicateOf).length === 2, "both duplicates link after the original exists");

console.log("import plan ok");
