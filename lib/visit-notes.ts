/** Contact-level notes that were never copied onto a visit. Mendel confirmed those existing notes are from Summer 5786. */
export const LEGACY_NOTE_VISIT = "Summer 5786";

export type LabeledNote = {
  id: string;
  label: string;
  notes: string;
};

type NoteVisit = {
  id: string;
  visited: string;
  notes: string;
  visitDate: string | null;
};

export function visitNoteLabel(visited: string, visitDate: string | null, formatDate: (iso: string) => string): string {
  const name = visited.trim() || "Visit";
  const date = visitDate?.trim() ?? "";
  if (!date) return name;
  const formatted = formatDate(date).trim();
  return formatted ? `${name} · ${formatted}` : name;
}

/**
 * Notes that already live on a visit keep that visit's name and date.
 * A contact-level note is shown once, as Summer 5786, unless the same text is already on a visit.
 */
export function labeledVisitNotes(householdNotes: string, visits: NoteVisit[], formatDate: (iso: string) => string): LabeledNote[] {
  const fromVisits = visits
    .filter((visit) => visit.notes.trim())
    .map((visit) => ({
      id: visit.id,
      label: visitNoteLabel(visit.visited, visit.visitDate, formatDate),
      notes: visit.notes.trim(),
    }));
  const legacy = householdNotes.trim();
  if (legacy && !fromVisits.some((item) => item.notes === legacy)) {
    fromVisits.push({ id: "household-notes", label: LEGACY_NOTE_VISIT, notes: legacy });
  }
  return fromVisits;
}
