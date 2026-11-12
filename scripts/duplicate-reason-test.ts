import { asDupSide, findLiveDuplicates, matchParts, reasonLead, streetParts, stripTitles, worthFlagging, type DupPerson } from "../lib/duplicate-reason";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function side(name: string, street: string, city = "Sanford", extras: { state?: string; people?: DupPerson[]; phone?: string; phone2?: string; email?: string } = {}) {
  const people = extras.people ?? [{ name, phone: extras.phone ?? "", phone2: extras.phone2 ?? "", email: extras.email ?? "" }];
  return asDupSide({ name, street, city, state: extras.state ?? "ME" }, people);
}

assert(stripTitles("Mrs. Ann Fleisher") === "ann fleisher", "titles are stripped");
assert(stripTitles("Mr. & Mrs. Allan Alterman") === "allan alterman", "Mr and Mrs and ampersand are stripped");
assert(stripTitles("Dr. Alan Hymanson") === "alan hymanson", "Dr is stripped");

const fleisher = matchParts(side("Ann Fleisher", "469 Elm St Ste 3", "Biddeford"), side("Mrs. Ann Fleisher", "469 Elm St Ste 3", "Biddeford"));
assert(fleisher.includes("same address") && fleisher.includes("same name"), `titles and suite: ${fleisher.join(", ")}`);
assert(worthFlagging(fleisher, side("Ann Fleisher", "469 Elm St Ste 3", "Biddeford"), side("Mrs. Ann Fleisher", "469 Elm St Ste 3", "Biddeford")), "Fleisher is flagged");

const westview = matchParts(
  side("Victor E. Digregorio", "197 Westview Drive"),
  side("Victor E. Digregorio", "197 West View Drive"),
);
assert(westview.includes("same address") || westview.includes("similar address"), `Westview vs West View: ${westview.join(", ")}`);
assert(westview.includes("same name"), "Digregorio names match");
assert(reasonLead(westview).toLowerCase().includes("address"), `reason mentions address: ${reasonLead(westview)}`);

const houseMismatch = matchParts(side("Roberta Gerson", "459 Pool St", "Biddeford"), side("Jack & Phyllis Gerson", "463 Pool St", "Biddeford"));
assert(!houseMismatch.includes("same address") && !houseMismatch.includes("similar address"), `different house numbers are not similar: ${houseMismatch.join(", ")}`);
assert(!worthFlagging(houseMismatch, side("Roberta Gerson", "459 Pool St", "Biddeford"), side("Jack & Phyllis Gerson", "463 Pool St", "Biddeford")), "nearby Pool St houses are not flagged");

const phone2 = matchParts(
  side("Pat One", "1 Main St", "York", { phone: "207-555-0100" }),
  side("Pat Two", "9 Other Rd", "York", { phone2: "(207) 555-0100" }),
);
assert(phone2.includes("same phone"), `phone2 matches phone: ${phone2.join(", ")}`);
assert(worthFlagging(phone2, side("Pat One", "1 Main St", "York"), side("Pat Two", "9 Other Rd", "York")), "same phone is flagged even at different addresses");

const typo = matchParts(side("Sara Fineberg", "10 Oak St", "York"), side("Sara Feinberg", "10 Oak St", "York"));
assert(typo.includes("similar name") || typo.includes("same name"), `Fineberg/Feinberg: ${typo.join(", ")}`);

const nick = matchParts(side("Bill Smith", "5 Pine St", "York"), side("William Smith", "5 Pine St", "York"));
assert(nick.includes("similar name") || nick.includes("same name"), `Bill/William: ${nick.join(", ")}`);
assert(matchParts(side("Steve Ornstein", "1 A St", "Portland"), side("Stephen Ornstein", "1 A St", "Portland")).some((part) => part.endsWith("name")), "Steve/Stephen");

const missingStreet = matchParts(
  side("Ms. Vivienne Sohn", "9 Moose Point Rd", "Windham"),
  asDupSide({ name: "Vivienne Sohn", street: "", city: "Windham", state: "ME" }, [{ name: "Vivienne Sohn" }]),
);
assert(missingStreet.includes("same name") || missingStreet.includes("similar name"), `Vivienne name: ${missingStreet.join(", ")}`);
assert(
  worthFlagging(missingStreet, side("Ms. Vivienne Sohn", "9 Moose Point Rd", "Windham"), asDupSide({ name: "Vivienne Sohn", street: "", city: "Windham", state: "ME" }, [{ name: "Vivienne Sohn" }])),
  "Vivienne Sohn with a missing street is flagged",
);

const differentTowns = matchParts(side("John Smith", "10 Oak St", "York"), side("John Smith", "20 Maple Ave", "Portland"));
assert(!worthFlagging(differentTowns, side("John Smith", "10 Oak St", "York"), side("John Smith", "20 Maple Ave", "Portland")), "same name at clearly different addresses is not flagged");

assert(streetParts(side("A", "801 US Rte 1 Unit D3", "York")).compact.includes("rte"), "US Rte is normalized");
const route = matchParts(side("Deborah Levine", "801 Rte 1", "York"), side("Nancy Rosen", "801 US Rte 1 Unit D3", "York"));
assert(route.includes("same address") || route.includes("similar address"), `Route 1 unit strip: ${route.join(", ")}`);

const berzinis = matchParts(
  side("Wayne & Suzie Berzinis", "29 Phil Hunt Rd.", "Windham"),
  side("Mr. & Mrs. Wayne Berzinis", "29 Phil Hunt Rd.", "Windham"),
);
assert(berzinis.includes("same address") && (berzinis.includes("same name") || berzinis.includes("similar name")), `Berzinis: ${berzinis.join(", ")}`);

const households = [
  { id: "a", name: "Ann Fleisher", street: "469 Elm St Ste 3", city: "Biddeford", state: "ME" },
  { id: "b", name: "Mrs. Ann Fleisher", street: "469 Elm St Ste 3", city: "Biddeford", state: "ME" },
  { id: "c", name: "Victor E. Digregorio", street: "197 Westview Drive", city: "Sanford", state: "ME" },
  { id: "d", name: "Victor E. Digregorio", street: "197 West View Drive", city: "Sanford", state: "ME" },
  { id: "e", name: "Ms. Vivienne Sohn", street: "9 Moose Point Rd", city: "Windham", state: "ME" },
  { id: "f", name: "Vivienne Sohn", street: "", city: "Windham", state: "ME" },
  { id: "g", name: "Roberta Gerson", street: "459 Pool St", city: "Biddeford", state: "ME" },
  { id: "h", name: "Jack & Phyllis Gerson", street: "463 Pool St", city: "Biddeford", state: "ME" },
  { id: "gone", name: "Ann Fleisher", street: "469 Elm St Ste 3", city: "Biddeford", state: "ME", deletedAt: "2026-01-01" },
];
const peopleBy = new Map<string, DupPerson[]>(households.map((item) => [item.id, [{ name: item.name }]]));

const live = findLiveDuplicates(households, peopleBy, []);
assert(live.get("a")?.matchId === "b" && live.get("b")?.matchId === "a", "Fleisher pair is linked both ways");
assert(live.get("c")?.matchId === "d" && live.get("d")?.matchId === "c", "Digregorio pair is linked");
assert(live.get("e")?.matchId === "f" && live.get("f")?.matchId === "e", "Vivienne Sohn pair is linked");
assert(!live.has("g") && !live.has("h"), "different house numbers are not flagged");
assert(!live.has("gone"), "soft-deleted contacts are skipped");

const skipped = findLiveDuplicates(households, peopleBy, ["a|b"]);
assert(!skipped.has("a") && !skipped.has("b"), "pairs marked not a duplicate are skipped");
assert(skipped.has("c") && skipped.has("e"), "other pairs still flag");

assert(reasonLead(["same address"]) === "Same address as", "same address reason");
assert(reasonLead(["similar name"]) === "Similar name to", "similar name reason");
assert(reasonLead(["same phone"]) === "Same phone as", "same phone reason");
assert(reasonLead(["same address", "similar name"]) === "Same address and similar name as", "combined reason");

console.log("duplicate reason ok");
