import { appendGrokNote, CORA_CONNECT_NOTE_LABEL, CORA_CONNECT_NOTE_PREFIX, GROK_NOTE_LABEL, labeledVisitNotes, LEGACY_NOTE_VISIT, splitHouseholdNotes, visitNoteLabel } from "../lib/visit-notes";

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

assert(GROK_NOTE_LABEL === CORA_CONNECT_NOTE_LABEL, "old constant name still points at the new label");

const grokOnly = labeledVisitNotes("Grok note: Whitepages lookup Nov 11, 2026.\nGrok note: email from une.edu", [], formatDate);
assert(grokOnly.length === 2, "each legacy Grok note is its own item");
assert(grokOnly[0]?.label === CORA_CONNECT_NOTE_LABEL && grokOnly[0]?.notes === "Whitepages lookup Nov 11, 2026.", "legacy Grok prefix displays as CORA Connect note");
assert(grokOnly[1]?.label === CORA_CONNECT_NOTE_LABEL && grokOnly[1]?.notes === "email from une.edu", "second legacy Grok note is separate");
assert(grokOnly.every((note) => note.label !== LEGACY_NOTE_VISIT), "bot notes are not labeled Summer 5786");

const coraOnly = labeledVisitNotes("CORA Connect note: Whitepages lookup Nov 11, 2026.\nCORA Connect note: email from une.edu", [], formatDate);
assert(coraOnly.length === 2 && coraOnly.every((note) => note.label === CORA_CONNECT_NOTE_LABEL), "new prefix displays as CORA Connect note");
assert(coraOnly[0]?.notes === "Whitepages lookup Nov 11, 2026." && coraOnly[1]?.notes === "email from une.edu", "new prefix is stripped from the body");

const mixedPrefixes = labeledVisitNotes("Grok note: one\nCORA Connect note: two", [], formatDate);
assert(mixedPrefixes.length === 2 && mixedPrefixes.every((note) => note.label === CORA_CONNECT_NOTE_LABEL), "mixed prefixes both show as CORA Connect note");

const mixed = labeledVisitNotes("User wrote this first.\nGrok note: email from crmvet.org", [], formatDate);
assert(mixed.length === 2, "legacy and bot notes are split");
assert(mixed[0]?.label === LEGACY_NOTE_VISIT && mixed[0]?.notes === "User wrote this first.", "user text stays Summer 5786");
assert(mixed[1]?.label === CORA_CONNECT_NOTE_LABEL && mixed[1]?.notes === "email from crmvet.org", "bot text is a CORA Connect note");

assert(appendGrokNote("", "email from une.edu") === "CORA Connect note: email from une.edu", "append on empty uses the new prefix");
assert(appendGrokNote("Already here", "email from une.edu") === "Already here\nCORA Connect note: email from une.edu", "append keeps existing text");
assert(appendGrokNote("CORA Connect note: email from une.edu", "email from une.edu") === "CORA Connect note: email from une.edu", "append does not duplicate");
assert(appendGrokNote("Grok note: email from une.edu", "email from une.edu") === "Grok note: email from une.edu", "append does not add a second line when a legacy Grok note already has the same body");
assert(splitHouseholdNotes("Grok note: one\n\nUser leftover").legacy === "User leftover", "legacy leftover is preserved");
assert(CORA_CONNECT_NOTE_PREFIX === "CORA Connect note:", "write prefix is CORA Connect note:");

console.log("visit notes ok");
