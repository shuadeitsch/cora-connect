import { contactInTerritory, isBlankReactionText, normalizeState, parseHouseholdReaction } from "@/lib/constants";
import { parseContactTags } from "@/lib/contact-tags";
import { emailKey, phoneKey } from "@/lib/csv";
import type { HouseholdReaction } from "@/lib/types";
import { parseVisitStatus, type VisitProgress } from "@/lib/visit-status";

export interface ImportRow {
  name: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  shareWithCora: boolean | null;
  tags: string;
  visited: string;
  status: string;
  reaction: string;
  notes: string;
  visitDate: string;
}

export interface ExistingContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  street?: string;
  city?: string;
  visited: string[];
}

export interface PlannedVisit {
  visited: string;
  reaction: HouseholdReaction | null;
  notes: string;
  visitDate: string;
  status: VisitProgress;
}

export interface PlannedContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  shareWithCora: boolean | null;
  tags: string[];
  visits: PlannedVisit[];
  existingId: string | null;
  possibleDuplicate: boolean;
  duplicateOfId: string | null;
  duplicateReason: string;
  warnings: string[];
  /** Spreadsheet rows this record accounts for, including visits merged onto it. */
  fromRows: number;
}

export interface ImportPlan {
  rowsRead: number;
  contacts: PlannedContact[];
  created: number;
  visitsMerged: number;
  possible: number;
  warnings: string[];
}

export function normName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 2) return 3;
  const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
  const next = new Array<number>(right.length + 1);
  for (let i = 1; i <= left.length; i++) {
    next[0] = i;
    let rowMin = next[0]!;
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      next[j] = Math.min(next[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
      rowMin = Math.min(rowMin, next[j]!);
    }
    if (rowMin > 2) return 3;
    for (let j = 0; j < prev.length; j++) prev[j] = next[j]!;
  }
  return prev[right.length] ?? 3;
}

export function namesNearlyMatch(left: string, right: string) {
  const a = normName(left);
  const b = normName(right);
  if (!a || !b || a === b) return false;
  if (a.length >= 5 && b.length >= 5 && levenshtein(a, b) <= 2) return true;
  const ta = a.split(" ");
  const tb = b.split(" ");
  if (ta.length >= 2 && tb.length >= 2 && ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1] && Math.abs(ta.length - tb.length) <= 1) {
    return true;
  }
  return false;
}

function samePerson(name: string, phone: string, email: string, otherName: string, otherPhone: string, otherEmail: string) {
  if (!normName(name) || normName(name) !== normName(otherName)) return false;
  const phoneSame = Boolean(phoneKey(phone) && phoneKey(phone) === phoneKey(otherPhone));
  const emailSame = Boolean(emailKey(email) && emailKey(email) === emailKey(otherEmail));
  return phoneSame || emailSame;
}

interface LooseSide { name: string; phone: string; email: string; street?: string; city?: string }

/**
 * Why two contacts might be the same, or "" when they shouldn't be flagged.
 * A name match alone never flags when both have an address and the addresses differ.
 */
function looseReason(a: LooseSide, b: LooseSide) {
  const { name, phone, email } = a;
  const { name: otherName, phone: otherPhone, email: otherEmail } = b;
  if (samePerson(name, phone, email, otherName, otherPhone, otherEmail)) return "";
  const aStreet = normName(a.street ?? "");
  const bStreet = normName(b.street ?? "");
  const bothAddressed = Boolean(aStreet && bStreet);
  const sameAddress = bothAddressed && aStreet === bStreet && normName(a.city ?? "") === normName(b.city ?? "");
  if (phoneKey(phone) && phoneKey(phone) === phoneKey(otherPhone) && normName(name) !== normName(otherName)) {
    return "Same phone, different name";
  }
  if (emailKey(email) && emailKey(email) === emailKey(otherEmail) && normName(name) !== normName(otherName)) {
    return "Same email, different name";
  }
  const nameMatch = Boolean(normName(name) && normName(name) === normName(otherName));
  const nearName = !nameMatch && namesNearlyMatch(name, otherName);
  if (sameAddress) return nameMatch || nearName ? "Same name and address" : "Same address, different name";
  if (bothAddressed) return "";
  if (nameMatch) return "Same name, no address to compare";
  if (nearName) return "Name is almost the same, no address to compare";
  return "";
}

function looseScore(reason: string) {
  if (reason.startsWith("Same phone")) return 80;
  if (reason.startsWith("Same email")) return 70;
  if (reason.startsWith("Same name and address")) return 75;
  if (reason.startsWith("Same address")) return 50;
  if (reason.startsWith("Same name")) return 60;
  if (reason.startsWith("Name is almost")) return 40;
  return 0;
}

function visitDate(value: string): { date: string; warning: string } {
  const raw = value.trim();
  if (!raw) return { date: "", warning: "" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: raw, warning: "" };
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return { date: "", warning: `“${raw}” is not a visit date, so the date was left blank.` };
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const month = match[1]!.padStart(2, "0");
  const day = match[2]!.padStart(2, "0");
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return { date: "", warning: `“${raw}” is not a visit date, so the date was left blank.` };
  }
  return { date, warning: "" };
}

function visitedKey(value: string) {
  return value.trim().toLowerCase();
}

function rowHasCells(row: ImportRow) {
  return Object.values(row).some((value) => String(value ?? "").trim() !== "");
}

interface Anchor {
  id: string;
  existingId: string | null;
  name: string;
  phone: string;
  email: string;
  visited: Set<string>;
  signatures: Set<string>;
  contact: PlannedContact | null;
}

function attachVisit(anchor: Anchor, visit: PlannedVisit, contacts: PlannedContact[]) {
  anchor.visited.add(visitedKey(visit.visited));
  if (anchor.contact) {
    anchor.contact.visits.push(visit);
    anchor.contact.fromRows += 1;
    return;
  }
  const carrier: PlannedContact = {
    id: anchor.id,
    name: anchor.name,
    phone: anchor.phone,
    email: anchor.email,
    street: "",
    city: "",
    state: "",
    zip: "",
    shareWithCora: null,
    tags: [],
    visits: [visit],
    existingId: anchor.existingId,
    possibleDuplicate: false,
    duplicateOfId: null,
    duplicateReason: "",
    warnings: [],
    fromRows: 1,
  };
  contacts.push(carrier);
  anchor.contact = carrier;
}

export function planImport(
  rows: ImportRow[],
  existing: ExistingContact[],
  options?: { territory?: { state: string; area: string }[]; fallbackVisited?: string; notDuplicatePairs?: string[] },
): ImportPlan {
  const notDup = new Set(options?.notDuplicatePairs ?? []);
  const confirmedApart = (a: string, b: string) => notDup.has(a < b ? `${a}|${b}` : `${b}|${a}`);
  const warnings: string[] = [];
  const dataRows = rows.filter(rowHasCells);
  const anchors: Anchor[] = existing.map((item) => ({
    id: item.id,
    existingId: item.id,
    name: item.name,
    phone: item.phone,
    email: item.email,
    visited: new Set(item.visited.map(visitedKey)),
    signatures: new Set<string>(),
    contact: null,
  }));
  const contacts: PlannedContact[] = [];

  for (const row of dataRows) {
    const rowWarnings: string[] = [];
    const named = row.name.trim();
    const name = named || "Unnamed contact";
    if (!named) rowWarnings.push("A row had no name, so it was saved as Unnamed contact.");
    const phone = row.phone.trim();
    let email = row.email.trim();
    if (email && !/.+@.+\..+/.test(email)) {
      rowWarnings.push(`${name}: “${email}” is not an email address, so it was left blank.`);
      email = "";
    }
    const street = row.street.trim();
    const city = row.city.trim();
    const state = row.state.trim();
    const zip = row.zip.trim();
    const reactionRaw = row.reaction.trim();
    let reaction = reactionRaw ? parseHouseholdReaction(reactionRaw) : null;
    if (reactionRaw && !reaction && !isBlankReactionText(reactionRaw)) {
      rowWarnings.push(`${name}: “${reactionRaw}” is not a reaction, so the reaction was left blank.`);
      reaction = null;
    }
    const status = parseVisitStatus(row.status);
    if (status.warning) rowWarnings.push(`${name}: ${status.warning}`);
    const tags = parseContactTags(row.tags);
    if (tags.unknown.length) rowWarnings.push(`${name}: unknown tag “${tags.unknown.join(", ")}”.`);
    const dated = visitDate(row.visitDate);
    if (dated.warning) rowWarnings.push(`${name}: ${dated.warning}`);
    const visited = row.visited.trim() || options?.fallbackVisited?.trim() || "";
    const notes = row.notes.trim();
    const territory = options?.territory ?? [];
    if (territory.length && state) {
      const code = normalizeState(state);
      const inState = territory.some((item) => normalizeState(item.state).toLowerCase() === code.toLowerCase());
      const allowed = contactInTerritory(territory, code, city) || (!city && inState);
      if (!allowed) rowWarnings.push(`${name}: that state is outside this territory.`);
    }
    const visit: PlannedVisit = { visited, reaction, notes, visitDate: dated.date, status: status.status };
    const signature = [
      normName(name),
      phoneKey(phone),
      emailKey(email),
      street.toLowerCase(),
      city.toLowerCase(),
      normalizeState(state).toLowerCase(),
      zip,
      visitedKey(visited),
      reaction ?? "",
      notes,
      dated.date,
      status.status,
    ].join("|");
    const same = anchors.find((anchor) => samePerson(name, phone, email, anchor.name, anchor.phone, anchor.email));
    if (same && same.visited.has(visitedKey(visited))) {
      const prior = same.contact?.visits.find((item) => visitedKey(item.visited) === visitedKey(visited));
      if (prior && !prior.reaction && reaction) prior.reaction = reaction;
      if (prior && !prior.notes && notes) prior.notes = notes;
    }
    if (same && !same.visited.has(visitedKey(visited))) {
      same.signatures.add(signature);
      attachVisit(same, visit, contacts);
      if (same.contact) {
        for (const tag of tags.tags) if (!same.contact.tags.includes(tag)) same.contact.tags.push(tag);
      }
      same.contact?.warnings.push(...rowWarnings);
      warnings.push(...rowWarnings);
      continue;
    }

    const id = crypto.randomUUID();
    const hasVisit = Boolean(visited || reaction || notes || dated.date || row.status.trim());
    const contact: PlannedContact = {
      id,
      name,
      phone,
      email,
      street,
      city,
      state,
      zip,
      shareWithCora: row.shareWithCora,
      tags: tags.tags,
      visits: hasVisit ? [visit] : [],
      existingId: null,
      possibleDuplicate: false,
      duplicateOfId: null,
      duplicateReason: "",
      warnings: rowWarnings,
      fromRows: 1,
    };
    if (same && !confirmedApart(id, same.id)) {
      contact.possibleDuplicate = true;
      contact.duplicateOfId = same.id;
      contact.duplicateReason = same.signatures.has(signature)
        ? "Exact duplicate row"
        : "Same person and the same Visited value";
    }
    contacts.push(contact);
    anchors.push({
      id,
      existingId: null,
      name,
      phone,
      email,
      visited: new Set([visitedKey(visited)]),
      signatures: new Set([signature]),
      contact,
    });
    warnings.push(...rowWarnings);
  }

  for (const contact of contacts) {
    if (contact.existingId || contact.possibleDuplicate) continue;
    let bestScore = 0;
    let bestId = "";
    let bestReason = "";
    for (const item of existing) {
      if (confirmedApart(contact.id, item.id)) continue;
      const reason = looseReason(contact, item);
      const score = looseScore(reason);
      if (score > bestScore) {
        bestScore = score;
        bestId = item.id;
        bestReason = reason;
      }
    }
    for (const other of contacts) {
      if (other.id === contact.id) break;
      if (other.existingId || confirmedApart(contact.id, other.id)) continue;
      const reason = looseReason(contact, other);
      const score = looseScore(reason);
      if (score > bestScore) {
        bestScore = score;
        bestId = other.id;
        bestReason = reason;
      }
    }
    if (bestId) {
      contact.possibleDuplicate = true;
      contact.duplicateOfId = bestId;
      contact.duplicateReason = bestReason;
    }
  }

  const created = contacts.filter((contact) => !contact.existingId).length;
  const visitsMerged = dataRows.length - created;
  return {
    rowsRead: dataRows.length,
    contacts,
    created,
    visitsMerged,
    possible: contacts.filter((contact) => contact.possibleDuplicate).length,
    warnings,
  };
}

export interface ImportWrite {
  contact: PlannedContact;
  /** Household id to insert. This is the planned id so later rows can reference it. */
  id: string;
  /** Set only when that contact is already in the database or earlier in this list. */
  duplicateOf: string | null;
}

/**
 * New contacts in an order that satisfies households_duplicate_of_fkey:
 * the contact a row is a duplicate of is inserted first. duplicateOf is null
 * when the target is not inserted yet (a cycle); callers can set it after every row exists.
 */
export function importWrites(contacts: PlannedContact[], existingIds: Iterable<string>): ImportWrite[] {
  const existing = new Set(existingIds);
  const pending = contacts.filter((contact) => !contact.existingId);
  const byId = new Map(pending.map((contact) => [contact.id, contact]));
  const ready = new Set(existing);
  const ordered: PlannedContact[] = [];
  let waiting = [...pending];
  let guard = waiting.length + 1;
  while (waiting.length && guard-- > 0) {
    const blocked: PlannedContact[] = [];
    for (const contact of waiting) {
      const target = contact.duplicateOfId;
      const waitingOnPeer = Boolean(target && byId.has(target) && !ready.has(target));
      if (waitingOnPeer) blocked.push(contact);
      else {
        ordered.push(contact);
        ready.add(contact.id);
      }
    }
    if (blocked.length === waiting.length) {
      ordered.push(...waiting);
      break;
    }
    waiting = blocked;
  }
  const inserted = new Set(existing);
  return ordered.map((contact) => {
    const target = contact.duplicateOfId;
    const duplicateOf = target && inserted.has(target) ? target : null;
    inserted.add(contact.id);
    return { contact, id: contact.id, duplicateOf };
  });
}
