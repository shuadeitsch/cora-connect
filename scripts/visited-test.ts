import { currentHebrewYear, formatVisited, hebrewYearChoices, parseVisited } from "../lib/visited";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const november2026 = new Date("2026-11-03T16:30:00Z");
assert(currentHebrewYear(november2026) === 5787, "3 Nov 2026 is Hebrew year 5787");
const years = hebrewYearChoices(november2026);
assert(years.includes(5786) && years.includes(5787) && years.includes(5788), "the picker offers the current year and years around it");
assert(formatVisited("Summer", "5786") === "Summer 5786", "a season and year are stored in the Visited field");
assert(formatVisited("Other", "5787") === "Other 5787", "Other is stored the same way");
assert(formatVisited("", "5787") === "", "a year without a season is not stored");

const summer = parseVisited("Summer 5786");
assert(summer.season === "Summer" && summer.year === "5786" && summer.raw === "", "Summer 5786 fills the two selects");
const chanukah = parseVisited("chanukah 5787");
assert(chanukah.season === "Chanukah" && chanukah.year === "5787", "season capitalization is normalized on display");
const free = parseVisited("Dropped by in July");
assert(free.season === "" && free.raw === "Dropped by in July", "an older free-text Visited value stays visible");
assert(parseVisited("").raw === "" && parseVisited("").season === "", "a blank Visited value stays blank");

console.log("visited ok");
