import { parseHouseholdReaction } from "@/lib/constants";
import { parseContactTags } from "@/lib/contact-tags";
import { parseVisitStatus } from "@/lib/visit-status";

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function phoneKey(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function emailKey(value: string): string {
  return value.trim().toLowerCase();
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => csvCell(cell ?? "")).join(","));
  return `\uFEFF${lines.join("\n")}`;
}

const HEADER_MAP: Record<string, string> = {
  "household name": "name",
  household: "name",
  name: "name",
  street: "street",
  address: "street",
  "home address": "street",
  city: "city",
  state: "state",
  zip: "zip",
  "zip code": "zip",
  postal: "zip",
  country: "country",
  "person name": "personName",
  person: "personName",
  "contact name": "personName",
  gender: "gender",
  phone: "phone",
  mobile: "phone",
  "mobile phone": "phone",
  email: "email",
  whatsapp: "whatsapp",
  "whats app": "whatsapp",
  categories: "categories",
  "regular categories": "categories",
  schedule: "schedule",
  "scheduled category": "schedule",
  frequency: "schedule",
  project: "project",
  notes: "notes",
  tags: "tags",
  lat: "lat",
  latitude: "lat",
  lng: "lng",
  lon: "lng",
  longitude: "lng",
};

export interface CsvHouseholdRow {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  personName: string;
  gender: string;
  phone: string;
  email: string;
  whatsapp: string;
  categories: string;
  schedule: string;
  project: string;
  notes: string;
  tags: string;
  lat: string;
  lng: string;
}

export function rowsFromCsv(text: string): { rows: CsvHouseholdRow[]; error?: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], error: "The file needs a header row and at least one household." };
  const headers = table[0].map((h) => HEADER_MAP[h.trim().toLowerCase()] ?? "");
  if (!headers.includes("name")) {
    return { rows: [], error: 'Add a "name" column to the file.' };
  }
  const rows = table.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((key, index) => {
      if (key) record[key] = (cells[index] ?? "").trim();
    });
    return {
      name: record.name ?? "",
      street: record.street ?? "",
      city: record.city ?? "",
      state: record.state ?? "",
      zip: record.zip ?? "",
      country: record.country ?? "",
      personName: record.personName ?? "",
      gender: record.gender ?? "",
      phone: record.phone ?? "",
      email: record.email ?? "",
      whatsapp: record.whatsapp ?? "",
      categories: record.categories ?? "",
      schedule: record.schedule ?? "",
      project: record.project ?? "",
      notes: record.notes ?? "",
      tags: record.tags ?? "",
      lat: record.lat ?? "",
      lng: record.lng ?? "",
    };
  });
  return { rows };
}

export const CANONICAL_HEADERS = [
  "name",
  "phone",
  "email",
  "address",
  "city",
  "state",
  "zip",
  "tags",
  "visited",
  "status",
  "reaction",
  "notes",
  "visit_date",
] as const;

export const IMPORT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "street", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "Zip" },
  { key: "tags", label: "Tags" },
  { key: "visited", label: "Visited" },
  { key: "status", label: "Status" },
  { key: "visitReaction", label: "Reaction" },
  { key: "notes", label: "Notes" },
  { key: "visitDate", label: "Visit date" },
  { key: "share", label: "Share with Cora" },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];

const IMPORT_HINTS: Record<ImportField, string[]> = {
  name: ["name", "full name", "contact name", "contact", "person", "person name", "household name", "household", "family", "family name"],
  phone: ["phone", "mobile", "cell", "whatsapp", "telephone"],
  email: ["email", "e-mail", "email address"],
  street: ["address", "street", "home address", "address 1"],
  city: ["city", "town"],
  state: ["state", "st"],
  zip: ["zip", "zip code", "postal", "postal code"],
  tags: ["tags", "tag"],
  share: ["share_with_cora", "share with cora", "share", "shared"],
  visited: ["visited", "project", "visit", "occasion"],
  status: ["status", "visit status"],
  visitReaction: ["reaction", "reaction when we visited", "visit reaction"],
  notes: ["notes", "note", "comments", "comment"],
  visitDate: ["visit_date", "visit date", "date", "date visited"],
};

export const IMPORT_TEMPLATE_CSV = [
  CANONICAL_HEADERS.join(","),
  "EXAMPLE Sample Contact,207-555-0100,sample.contact@example.com,12 Harbor Rd,Bangor,ME,04401,,Summer 5786,Completed,Warm,Stopped by the house,2026-07-01",
  "EXAMPLE Sample Contact,207-555-0100,sample.contact@example.com,12 Harbor Rd,Bangor,ME,04401,,Chanukah 5787,Deferred,Neutral,Brought a menorah,",
].join("\n");

export const IMPORT_AI_PROMPT = `You are formatting a contact list for Cora Connect. Output a CSV file and nothing else.

Use this header row exactly, in this order:
name,phone,email,address,city,state,zip,tags,visited,status,reaction,notes,visit_date

One row is one visit. The same person can appear on several rows when they were visited more than once. Those rows become that contact's Visit History. A row is the same person only when the name matches AND the phone or email matches, and the Visited value is different. Any other row becomes its own contact. Nothing is skipped.

Every column may be blank. If the name is blank, leave it blank. If you do not know a value, leave that cell empty. Do not add a share_with_cora column. Sharing uses the app's default.

Allowed values:
- visited: Summer 5786, Chanukah 5787, or any other short label for when you went. Leave blank if unknown.
- status: Completed or Deferred. Blank means Completed.
- visit_date: YYYY-MM-DD, or blank.
- reaction: Very happy, Warm, Neutral, Cold, or Very cold / angry. Neutral means "nisht ahin nisht aher". Leave blank if unknown.
- tags: Not Jewish, Probably doesn't exist, or both. Separate tags with a comma or a semicolon. Matching ignores capitalization. Leave blank if neither applies.
- state: Maine, Wisconsin, New Hampshire, or Unsorted. A 2-letter code (ME, WI, NH) or the full name is fine. Unsorted is for a contact that is not in one of those three states.
- phone: digits, with or without dashes or parentheses. Example: 207-555-0100.
- email: a normal email address, or blank.

Do not add a year-arrived column. Do not invent people who were not in the source list.`;

export function guessImportMap(headers: string[]): Record<ImportField, string> {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((field) => [field.key, ""])) as Record<ImportField, string>;
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const hit = headers.find((header) => {
      const key = header.trim().toLowerCase();
      return !used.has(header) && IMPORT_HINTS[field.key].includes(key);
    });
    if (hit) {
      mapping[field.key] = hit;
      used.add(hit);
    }
  }
  return mapping;
}

const HEADER_NAMES: Record<ImportField, string> = {
  name: "name",
  phone: "phone",
  email: "email",
  street: "address",
  city: "city",
  state: "state",
  zip: "zip",
  tags: "tags",
  share: "share_with_cora",
  visited: "visited",
  status: "status",
  visitReaction: "reaction",
  notes: "notes",
  visitDate: "visit_date",
};

const EXACT_HEADER_SETS: ImportField[][] = [
  ["name", "phone", "email", "street", "city", "state", "zip", "tags", "visited", "status", "visitReaction", "notes", "visitDate"],
  ["name", "phone", "email", "street", "city", "state", "zip", "share", "visited", "visitReaction", "notes", "visitDate"],
];

export function canonicalImportMap(headers: string[]): Record<ImportField, string> | null {
  const norm = headers.map((header) => header.trim().toLowerCase());
  const match = EXACT_HEADER_SETS.find((fields) => {
    const expected = fields.map((field) => HEADER_NAMES[field]);
    return norm.length === expected.length && expected.every((header, index) => norm[index] === header);
  });
  if (!match) return null;
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((field) => [field.key, ""])) as Record<ImportField, string>;
  match.forEach((field, index) => {
    mapping[field] = headers[index] ?? "";
  });
  return mapping;
}

export interface MappedContact {
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
  warnings: string[];
}

function parseShare(value: string): { share: boolean | null; warning: string } {
  const raw = value.trim().toLowerCase();
  if (!raw) return { share: null, warning: "" };
  if (["yes", "y", "true", "1", "shared"].includes(raw)) return { share: true, warning: "" };
  if (["no", "n", "false", "0", "private"].includes(raw)) return { share: false, warning: "" };
  return { share: null, warning: `“${value.trim()}” is not yes or no for Share with Cora.` };
}

export function mapContacts(
  text: string,
  mapping: Record<ImportField, string>,
): { headers: string[]; contacts: MappedContact[]; error?: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { headers: [], contacts: [], error: "The file needs a header row and at least one row." };
  const headers = table[0].map((header) => header.trim());
  const index = new Map(headers.map((header, position) => [header, position]));
  const byHeader = (cells: string[], aliases: string[]) => {
    const at = headers.findIndex((header) => aliases.includes(header.trim().toLowerCase()));
    return at < 0 ? "" : (cells[at] ?? "").trim();
  };
  const contacts: MappedContact[] = [];
  for (const cells of table.slice(1)) {
    if (!cells.some((cell) => cell.trim())) continue;
    const value = (field: ImportField) => {
      const header = mapping[field];
      if (!header) return "";
      const at = index.get(header);
      return at == null ? "" : (cells[at] ?? "").trim();
    };
    const first = byHeader(cells, ["first name", "first", "firstname"]);
    const last = byHeader(cells, ["last name", "last", "lastname", "surname"]);
    const name = value("name") || [first, last].filter(Boolean).join(" ");
    const email = value("email");
    const reaction = value("visitReaction");
    const share = parseShare(value("share"));
    const tags = parseContactTags(value("tags"));
    const status = parseVisitStatus(value("status"));
    const warnings: string[] = [];
    if (!name) warnings.push("No name. This row is still imported as Unnamed contact.");
    if (share.warning) warnings.push(share.warning);
    if (tags.unknown.length) warnings.push(`Unknown tag “${tags.unknown.join(", ")}”. Use Not Jewish or Probably doesn't exist.`);
    if (status.warning) warnings.push(status.warning);
    if (email && !/.+@.+\..+/.test(email)) warnings.push("Email does not look valid.");
    if (reaction && !parseHouseholdReaction(reaction)) warnings.push(`Unknown reaction “${reaction}”.`);
    contacts.push({
      name,
      phone: value("phone"),
      email,
      street: value("street"),
      city: value("city"),
      state: value("state"),
      zip: value("zip"),
      shareWithCora: share.share,
      tags: tags.tags.join(", "),
      visited: value("visited"),
      status: status.status,
      reaction,
      notes: value("notes"),
      visitDate: value("visitDate"),
      warnings,
    });
  }
  return { headers, contacts };
}
