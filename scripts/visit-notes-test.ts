import { appendGrokNote, GROK_NOTE_LABEL, labeledVisitNotes, LEGACY_NOTE_VISIT, splitHouseholdNotes, visitNoteLabel } from "../lib/visit-notes";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const formatDate = (iso: string) => (iso === "2026-07-04" ? "Jul 4, 2026" : iso);

assert(visitNoteLabel("Summer 5786", "2026-07-04", formatDate) === "Summer 5786 · Jul 4, 2026", "visit label includes the date");
assert(visitNoteLabel("Summer 5786", null, formatDate) === "Summer 5786", "a visit without a date is just the name");
assert(visitNoteLabel("Chanukah 5787", "2026-12-20", formatDate) === "Chanukah 5787 · 2026-12-20", "another visit keeps its own name");
assert(visitNoteLabel("", null, formatDate) === "Visit", "a blank visit name is not relabeled Summer 5786");

const labeled = labeledVisitNotes(
  "Left on the contact",
  [
    { id: "a", visited: "Summer 5786", notes: "Brought a calendar", visitDate: "2026-07-04" },
    { id: "b", visited: "Chanukah 5787", notes: "Menorah", visitDate: null },
  ],
  formatDate,
);
assert(labeled.length === 3, "each visit note stays, and the extra contact note is added");
assert(labeled[0]?.label === "Summer 5786 · Jul 4, 2026", "first note is the dated Summer visit");
assert(labeled[1]?.label === "Chanukah 5787", "second note stays on Chanukah");
assert(labeled[2]?.label === LEGACY_NOTE_VISIT && labeled[2]?.notes === "Left on the contact", "unattached contact note is Summer 5786");

const same = labeledVisitNotes("Brought a calendar", [
  { id: "a", visited: "Summer 5786", notes: "Brought a calendar", visitDate: null },
], formatDate);
assert(same.length === 1 && same[0]?.id === "a", "a contact note already stored on the visit is not repeated");

const onlyLegacy = labeledVisitNotes("Call before driving out", [], formatDate);
assert(onlyLegacy.length === 1 && onlyLegacy[0]?.label === "Summer 5786", "notes with no visit display as Summer 5786");

const grokOnly = labeledVisitNotes("Grok note: Whitepages lookup Nov 11, 2026.\nGrok note: email from une.edu", [], formatDate);
assert(grokOnly.length === 2, "each Grok note is its own item");
assert(grokOnly[0]?.label === GROK_NOTE_LABEL && grokOnly[0]?.notes === "Whitepages lookup Nov 11, 2026.", "first Grok note drops the prefix in the body");
assert(grokOnly[1]?.label === GROK_NOTE_LABEL && grokOnly[1]?.notes === "email from une.edu", "second Grok note is separate");
assert(grokOnly.every((note) => note.label !== LEGACY_NOTE_VISIT), "Grok notes are not labeled Summer 5786");

const mixed = labeledVisitNotes("User wrote this first.\nGrok note: email from crmvet.org", [], formatDate);
assert(mixed.length === 2, "legacy and Grok notes are split");
assert(mixed[0]?.label === LEGACY_NOTE_VISIT && mixed[0]?.notes === "User wrote this first.", "user text stays Summer 5786");
assert(mixed[1]?.label === GROK_NOTE_LABEL && mixed[1]?.notes === "email from crmvet.org", "bot text is a Grok note");

assert(appendGrokNote("", "email from une.edu") === "Grok note: email from une.edu", "append on empty");
assert(appendGrokNote("Already here", "email from une.edu") === "Already here\nGrok note: email from une.edu", "append keeps existing text");
assert(appendGrokNote("Grok note: email from une.edu", "email from une.edu") === "Grok note: email from une.edu", "append does not duplicate");
assert(splitHouseholdNotes("Grok note: one\n\nUser leftover").legacy === "User leftover", "legacy leftover is preserved");

console.log("visit notes ok");
