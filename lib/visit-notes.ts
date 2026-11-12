import { projectLabel } from "@/lib/constants";
/** Contact-level notes that were never copied onto a visit. Mendel confirmed those existing notes are from Summer 5786. */
export const LEGACY_NOTE_VISIT = "Summer 5786";
/** Label for contact-level notes written by Grok, not tied to a project or visit. */
export const GROK_NOTE_LABEL = "Grok note";
export const GROK_NOTE_PREFIX = "Grok note:";

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

export function isGrokNoteLine(line: string): boolean {
  return line.trim().toLowerCase().startsWith("grok note:");
}

export function grokNoteBody(line: string): string {
  return line.replace(/^\s*grok note:\s*/i, "").trim();
}

/** Append a contact-level Grok note without overwriting existing text. */
export function appendGrokNote(existing: string, text: string): string {
  const body = grokNoteBody(text);
  if (!body) return existing ?? "";
  const line = `${GROK_NOTE_PREFIX} ${body}`;
  const current = existing ?? "";
  const already = splitHouseholdNotes(current).grok.some((item) => item === body);
  if (already) return current;
  if (!current.trim()) return line;
  return `${current.replace(/\s+$/, "")}\n${line}`;
}

export function splitHouseholdNotes(text: string): { legacy: string; grok: string[] } {
  const grok: string[] = [];
  const legacyLines: string[] = [];
  for (const line of (text ?? "").split("\n")) {
    if (isGrokNoteLine(line) && grokNoteBody(line)) {
      grok.push(grokNoteBody(line));
    } else {
      legacyLines.push(line);
    }
  }
  return { legacy: legacyLines.join("\n").trim(), grok };
}

export function visitNoteLabel(visited: string, visitDate: string | null, formatDate: (iso: string) => string): string {
  const name = visited.trim() ? projectLabel(visited) : "Visit";
  const date = visitDate?.trim() ?? "";
  if (!date) return name;
  const formatted = formatDate(date).trim();
  return formatted ? `${name} · ${formatted}` : name;
}

/**
 * Notes that already live on a visit keep that visit's name and date.
 * Lines prefixed with "Grok note:" are shown as Grok notes, not as a project.
 * Any remaining contact-level note is shown once, as Summer 5786, unless the same text is already on a visit.
 */
export function labeledVisitNotes(householdNotes: string, visits: NoteVisit[], formatDate: (iso: string) => string): LabeledNote[] {
  const fromVisits = visits
    .filter((visit) => visit.notes.trim())
    .map((visit) => ({
      id: visit.id,
      label: visitNoteLabel(visit.visited, visit.visitDate, formatDate),
      notes: visit.notes.trim(),
    }));
  const { legacy, grok } = splitHouseholdNotes(householdNotes);
  if (legacy && !fromVisits.some((item) => item.notes === legacy)) {
    fromVisits.push({ id: "household-notes", label: LEGACY_NOTE_VISIT, notes: legacy });
  }
  grok.forEach((body, index) => {
    fromVisits.push({ id: `grok-note-${index}`, label: GROK_NOTE_LABEL, notes: body });
  });
  return fromVisits;
}
