import { normalizeRequestedTime, parseReachedHow, preplannerSortKey, preplannerWhen, reachedHowLabel } from "../lib/preplanner";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

assert(normalizeRequestedTime("9:05") === "09:05", "pads the hour");
assert(normalizeRequestedTime("14:30:00") === "14:30", "strips seconds");
assert(normalizeRequestedTime("24:00") === null, "rejects an invalid hour");
assert(normalizeRequestedTime("") === null, "requires a time");
assert(parseReachedHow("whatsapp") === "whatsapp", "keeps a known channel");
assert(parseReachedHow("pigeon") === "other", "unknown channels become Other");
assert(reachedHowLabel("in_person") === "In person", "labels In person");
assert(preplannerWhen("2026-11-16", "09:05").includes("9:05"), `time in label, got ${preplannerWhen("2026-11-16", "09:05")}`);
assert(preplannerSortKey("2026-11-16", "9:05") < preplannerSortKey("2026-11-16", "10:00"), "sorts by time on the same day");
assert(preplannerSortKey("2026-11-15", "23:00") < preplannerSortKey("2026-11-16", "00:30"), "sorts by date first");
console.log("preplanner-test ok");
