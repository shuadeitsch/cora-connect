import type { HouseholdReaction, MemberStatus, Reaction, VisitStatus } from "@/lib/types";

export const OWNER_EMAIL = "shuadeitsch@gmail.com";

export const ACCOUNT_STATUS_LABEL: Record<MemberStatus, string> = {
  invited: "Invited",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  disabled: "Disabled",
};

export function normalizeAccountStatus(value: string): MemberStatus {
  if (value === "registered" || value === "approved") return "approved";
  if (value === "invited" || value === "pending" || value === "rejected" || value === "disabled") return value;
  return "pending";
}

export const REACTIONS: { id: Reaction; label: string; emoji: string; color: string }[] = [
  { id: "happy", label: "Happy", emoji: "😄", color: "#1f9d62" },
  { id: "warm", label: "Warm", emoji: "😊", color: "#e39b12" },
  { id: "neutral", label: "Neutral", emoji: "😐", color: "#64708a" },
  { id: "cold", label: "Cold", emoji: "🥶", color: "#3b82f6" },
  { id: "not_interested", label: "Not interested", emoji: "🚫", color: "#e11d48" },
];

export const STATUS_META: Record<VisitStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  deferred: { label: "Deferred", className: "bg-amber-50 text-amber-800 ring-amber-200" },
};

export function reactionMeta(id: Reaction | null) {
  return REACTIONS.find((item) => item.id === id) ?? null;
}

export function statusMeta(status: VisitStatus | null | undefined) {
  if (status === "completed" || status === "deferred") return STATUS_META[status];
  return { label: "—", className: "bg-muted text-muted-foreground ring-border" };
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Cora Connect admin",
  shliach: "Shliach",
  visitor: "Visitor",
  limited: "Limited",
};

export const UNSORTED_STATE = "Unsorted";

export const FOCUS_STATES = [
  { code: "ME", name: "Maine" },
  { code: "WI", name: "Wisconsin" },
  { code: "NH", name: "New Hampshire" },
  { code: UNSORTED_STATE, name: UNSORTED_STATE },
] as const;

export const VISIT_REACTIONS: { id: HouseholdReaction; label: string; hint: string; className: string }[] = [
  { id: "very_happy", label: "Very happy", hint: "", className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" },
  { id: "warm", label: "Warm", hint: "", className: "bg-amber-500/15 text-amber-900 dark:text-amber-100" },
  { id: "neutral", label: "Neutral", hint: "nisht ahin nisht aher", className: "bg-slate-500/15 text-slate-700 dark:text-slate-200" },
  { id: "cold", label: "Cold", hint: "", className: "bg-sky-500/15 text-sky-900 dark:text-sky-100" },
  { id: "very_cold", label: "Very cold / angry", hint: "", className: "bg-rose-500/15 text-rose-800 dark:text-rose-200" },
];

export function visitReactionMeta(id: HouseholdReaction | null | undefined) {
  return VISIT_REACTIONS.find((item) => item.id === id) ?? null;
}

/** Lowercase, treat slashes and punctuation as spaces, and collapse spacing. */
export function normalizeReactionText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BLANK_REACTIONS = ["n a", "na", "none", "not applicable", "blank"];

/** Longest phrase wins, so "very cold" is not stored as Cold. */
const REACTION_PHRASES: [string, HouseholdReaction][] = [
  ["very cold angry", "very_cold"],
  ["nisht ahin nisht aher", "neutral"],
  ["not interested", "very_cold"],
  ["very happy", "very_happy"],
  ["very cold", "very_cold"],
  ["neutral", "neutral"],
  ["happy", "very_happy"],
  ["angry", "very_cold"],
  ["warm", "warm"],
  ["cold", "cold"],
];

function hasPhrase(text: string, phrase: string): boolean {
  return text === phrase || text.startsWith(`${phrase} `) || text.endsWith(` ${phrase}`) || text.includes(` ${phrase} `);
}

export function parseHouseholdReaction(value: string): HouseholdReaction | null {
  const raw = normalizeReactionText(value);
  if (!raw || BLANK_REACTIONS.includes(raw)) return null;
  const phrases = [...REACTION_PHRASES].sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, id] of phrases) {
    if (hasPhrase(raw, phrase)) return id;
  }
  return null;
}

/** N/A and similar words mean the spreadsheet had no reaction, not an unknown one. */
export function isBlankReactionText(value: string): boolean {
  const raw = normalizeReactionText(value);
  return !raw || BLANK_REACTIONS.includes(raw);
}

export function stateLabel(value: string): string {
  const code = normalizeState(value);
  if (code === UNSORTED_STATE) return UNSORTED_STATE;
  const named = US_STATES.find(([abbr]) => abbr === code);
  return named ? named[1] : value.trim();
}

export function sameState(left: string, right: string): boolean {
  if (!left.trim() || !right.trim()) return false;
  return normalizeState(left).toLowerCase() === normalizeState(right).toLowerCase();
}

/** Blank, the word Unsorted, or a value that is not a US state. Maine, Wisconsin, and New Hampshire stay on their own tabs. */
export function isUnsortedState(value: string): boolean {
  const raw = value.trim();
  if (!raw) return true;
  const code = normalizeState(raw);
  if (code === UNSORTED_STATE) return true;
  return !US_STATES.some(([abbr]) => abbr === code);
}

export function matchesStateFilter(householdState: string, filter: string): boolean {
  if (!filter.trim()) return true;
  if (sameState(filter, UNSORTED_STATE)) return isUnsortedState(householdState);
  return sameState(householdState, filter);
}

/** Who you are and what you are looking at. Pass the open state tab ("" for All states) to show it instead of the default. */
export function scopeLabel(role: string, territory: { state: string }[], viewing: string | null = null): string {
  const looking = viewing === null ? null : viewing.trim() ? stateLabel(viewing) : "All states";
  if (role === "admin") return `Cora · ${looking ?? "All states"}`;
  if (role === "shliach") {
    if (looking) return `Shliach · ${looking}`;
    const names = [...new Set(territory.map((row) => stateLabel(row.state)).filter(Boolean))];
    if (names.length === 1) return `Shliach · ${names[0]}`;
    if (names.length > 1) return `Shliach · ${names.join(", ")}`;
    return "Shliach";
  }
  return ROLE_LABEL[role] ?? role;
}

export const CONTACT_PROJECTS = ["Summer 5786", "Chanukah 5787"] as const;
/** Everything that isn't one of CONTACT_PROJECTS (or has no project) shows as this. */
export const UNSORTED_PROJECT = "Unsorted";

export function isListedProject(name: string | null | undefined): boolean {
  const key = (name ?? "").trim().toLowerCase();
  return CONTACT_PROJECTS.some((item) => item.toLowerCase() === key);
}

/** The project name to show: Summer 5786, Chanukah 5787, or Unsorted. */
export function projectLabel(name: string | null | undefined): string {
  const key = (name ?? "").trim().toLowerCase();
  return CONTACT_PROJECTS.find((item) => item.toLowerCase() === key) ?? UNSORTED_PROJECT;
}

/** Only the listed projects, in the listed order. */
export function listedProjects<T extends { name: string }>(projects: T[]): T[] {
  return CONTACT_PROJECTS.flatMap((name) => projects.filter((project) => project.name.trim() === name).slice(0, 1));
}

export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

export function normalizeState(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "unsorted") return UNSORTED_STATE;
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  const hit = US_STATES.find(([, name]) => name.toLowerCase() === raw.toLowerCase());
  return hit ? hit[0] : raw;
}

export function contactInTerritory(
  territory: { state: string; area: string }[],
  state: string,
  city: string,
): boolean {
  const wanted = normalizeState(state).toLowerCase();
  const cityKey = city.trim().toLowerCase();
  const rows = territory.filter((row) => normalizeState(row.state).toLowerCase() === wanted);
  if (!rows.length) return false;
  if (rows.some((row) => !row.area.trim())) return true;
  return rows.some((row) => row.area.trim().toLowerCase() === cityKey);
}

export function projectChoices<T extends { id: string; name: string }>(projects: T[], currentId?: string | null): T[] {
  void currentId; // Other projects show as Unsorted, so they are not offered.
  return listedProjects(projects);
}
