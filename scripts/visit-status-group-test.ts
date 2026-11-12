import { compareVisitStatusGroup, visitFilterSeason, visitStatusGroup } from "../lib/visit-status";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

const completed = { visited: "Summer 5786", status: "completed" as const };
const deferred = { visited: "Summer 5786", status: "deferred" as const };
const noStatus = { visited: "Chanukah 5787", status: null };
const blank = { visited: "", status: "completed" as const };
const notVisitedText = { visited: "not visited", status: "completed" as const };
const otherSeasonDeferred = { visited: "Chanukah 5787", status: "deferred" as const };

assert(visitStatusGroup([completed]) === "visited", "completed is visited");
assert(visitStatusGroup([noStatus]) === "visited", "a real visit with no status is visited");
assert(visitStatusGroup([deferred]) === "deferred", "only deferred is deferred");
assert(visitStatusGroup([completed, deferred]) === "visited", "a completed visit wins over a deferred visit");
assert(visitStatusGroup([]) === "not_visited", "no visits is not visited");
assert(visitStatusGroup([blank, notVisitedText]) === "not_visited", "blank or not-visited text does not count");
assert(visitStatusGroup(undefined) === "not_visited", "missing visits is not visited");

assert(visitStatusGroup([deferred, otherSeasonDeferred], "Summer 5786") === "deferred", "season uses only that season");
assert(visitStatusGroup([completed, otherSeasonDeferred], "Chanukah 5787") === "deferred", "completed in another season is ignored");
assert(visitStatusGroup([completed], "Chanukah 5787") === "not_visited", "no visit in that season is not visited");

const rows = [
  { name: "Zed", contactVisits: [] },
  { name: "Ann", contactVisits: [deferred] },
  { name: "Bea", contactVisits: [completed] },
  { name: "Cal", contactVisits: [deferred] },
  { name: "Ada", contactVisits: [completed] },
].sort((a, b) => compareVisitStatusGroup(a, b) || a.name.localeCompare(b.name));
assert(
  rows.map((row) => row.name).join(",") === "Ada,Bea,Ann,Cal,Zed",
  `group then name: ${rows.map((row) => row.name).join(",")}`,
);

assert(visitFilterSeason("__any_visit", "__any_visit", "__not_visited") === undefined, "all visits has no season");
assert(visitFilterSeason("__not_visited", "__any_visit", "__not_visited") === undefined, "not visited has no season");
assert(visitFilterSeason("Summer 5786", "__any_visit", "__not_visited") === "Summer 5786", "a season is kept");
assert(visitFilterSeason("", "__any_visit", "__not_visited") === undefined, "unset has no season");

console.log("visit status group ok");
