import { isUnsortedState, matchesStateFilter, normalizeState, stateLabel } from "../lib/constants";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(normalizeState("unsorted") === "Unsorted", "unsorted canonicalizes");
assert(normalizeState("Maine") === "ME", "Maine still becomes ME");
assert(normalizeState("WI") === "WI", "WI stays WI");
assert(normalizeState("New Hampshire") === "NH", "New Hampshire still becomes NH");
assert(stateLabel("Unsorted") === "Unsorted", "Unsorted label");
assert(stateLabel("unsorted") === "Unsorted", "unsorted label");

assert(matchesStateFilter("Maine", "Maine"), "Maine tab keeps Maine");
assert(!matchesStateFilter("Unsorted", "Maine"), "Unsorted is not on the Maine tab");
assert(!matchesStateFilter("", "Wisconsin"), "a blank state is not Wisconsin");
assert(!matchesStateFilter("Iowa", "New Hampshire"), "Iowa is not New Hampshire");

assert(matchesStateFilter("Unsorted", "Unsorted"), "explicit Unsorted");
assert(matchesStateFilter("unsorted", "Unsorted"), "any casing of Unsorted");
assert(matchesStateFilter("", "Unsorted"), "blank state shows under Unsorted");
assert(matchesStateFilter("n/a", "Unsorted"), "unrecognized text shows under Unsorted");
assert(!matchesStateFilter("Iowa", "Unsorted"), "another US state stays off the Unsorted tab");
assert(!matchesStateFilter("South Dakota", "Unsorted"), "South Dakota stays off the Unsorted tab");
assert(isUnsortedState(""), "blank is unsorted");
assert(!isUnsortedState("NH"), "NH is not unsorted");

console.log("state filter ok");
