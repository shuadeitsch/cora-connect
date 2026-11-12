import { emailKey, phoneKey } from "@/lib/csv";
import { normalizeState } from "@/lib/constants";

function normName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** What we compare for a possible duplicate. Worked out on the fly; nothing is stored. */
export type DupPerson = {
  name: string;
  phone?: string;
  phone2?: string;
  phone3?: string;
  email?: string;
};

export type DupPlace = {
  name: string;
  street?: string;
  city?: string;
  state?: string;
  deletedAt?: string | null;
};

export interface DupSide {
  household: DupPlace;
  people: DupPerson[];
}

export type MatchPart =
  | "same address"
  | "similar address"
  | "same phone"
  | "same email"
  | "same name"
  | "similar name";

const TITLES = new Set([
  "mr", "mrs", "ms", "miss", "dr", "doctor", "prof", "professor",
  "rabbi", "rebbe", "rev", "reverend", "hon", "honorable", "sir", "madam", "dame",
  "fr", "father", "br", "brother", "atty", "esq", "jr", "sr", "ii", "iii", "iv",
  "phd", "md", "dds", "the",
]);

const STREET_SUFFIX: Record<string, string> = {
  street: "st",
  streets: "st",
  drive: "dr",
  drives: "dr",
  road: "rd",
  roads: "rd",
  avenue: "ave",
  avenues: "ave",
  av: "ave",
  lane: "ln",
  lanes: "ln",
  boulevard: "blvd",
  court: "ct",
  courts: "ct",
  place: "pl",
  terrace: "ter",
  terr: "ter",
  circle: "cir",
  highway: "hwy",
  parkway: "pkwy",
  trail: "trl",
  square: "sq",
  apartment: "apt",
  suite: "ste",
  building: "bldg",
  floor: "fl",
};

const UNIT_WORDS = new Set(["apt", "apartment", "unit", "ste", "suite", "bldg", "building", "fl", "floor", "rm", "room", "lot", "#", "spc", "space", "trlr", "trailer"]);

const NICK_GROUPS = [
  ["robert", "rob", "bob", "bobby", "robbie", "bert"],
  ["william", "will", "bill", "billy", "willie", "liam"],
  ["john", "jack", "johnny", "jon"],
  ["richard", "rick", "dick", "richie", "rich"],
  ["james", "jim", "jimmy", "jamie"],
  ["michael", "mike", "mick", "mikey"],
  ["joseph", "joe", "joey"],
  ["thomas", "tom", "tommy"],
  ["charles", "chuck", "charlie", "chas"],
  ["edward", "ed", "ted", "eddie", "teddy"],
  ["david", "dave", "davey"],
  ["steven", "stephen", "steve"],
  ["andrew", "andy", "drew"],
  ["anthony", "tony"],
  ["christopher", "chris"],
  ["daniel", "dan", "danny"],
  ["matthew", "matt"],
  ["benjamin", "ben", "benny"],
  ["samuel", "sam", "sammy"],
  ["jonathan", "jonny"],
  ["nicholas", "nick", "nicky"],
  ["elizabeth", "liz", "lizzy", "beth", "betty", "eliza"],
  ["katherine", "kathryn", "catherine", "kate", "kathy", "katy", "katie", "kit", "kay"],
  ["jennifer", "jen", "jenny"],
  ["margaret", "meg", "maggie", "peggy", "marge"],
  ["patricia", "pat", "patty", "tricia", "trish"],
  ["susan", "sue", "suzy", "susie"],
  ["deborah", "deb", "debbie"],
  ["barbara", "barb"],
  ["virginia", "ginny", "ginnie"],
  ["jessica", "jess", "jessie"],
  ["victoria", "vicky", "vicki"],
  ["alexander", "alex", "xander"],
  ["alexandra", "allie", "sandy"],
  ["jacob", "jake"],
  ["gregory", "greg"],
  ["peter", "pete"],
  ["philip", "phillip", "phil"],
  ["ronald", "ron", "ronnie"],
  ["donald", "don", "donnie"],
  ["lawrence", "larry"],
  ["raymond", "ray"],
  ["gerald", "gerry", "jerry"],
  ["kenneth", "ken", "kenny"],
  ["timothy", "tim", "timmy"],
  ["frederick", "fred", "freddy"],
  ["theodore", "ted", "teddy", "theo"],
  ["walter", "walt"],
  ["franklin", "frank"],
  ["nancy", "nan", "annie"],
];

const NICK = new Map<string, string>();
for (const group of NICK_GROUPS) {
  const key = group[0]!;
  for (const name of group) NICK.set(name, key);
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

function typoClose(left: string, right: string) {
  if (!left || !right || left === right) return false;
  const min = Math.min(left.length, right.length);
  const dist = levenshtein(left, right);
  if (min >= 8) return dist <= 2;
  if (min >= 4) return dist <= 1;
  return false;
}

function softenName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripTitles(name: string) {
  return softenName(name)
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token && !TITLES.has(token))
    .join(" ");
}

function nameParts(name: string): { firsts: string[]; last: string } {
  const raw = softenName(name);
  if (!raw) return { firsts: [], last: "" };
  const comma = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (comma.length >= 2) {
    const last = stripTitles(comma[0]!).replace(/\s+/g, "");
    const firsts = stripTitles(comma.slice(1).join(" ")).split(" ").filter((token) => token && token !== "and");
    return { firsts, last };
  }
  const tokens = stripTitles(name).split(" ").filter((token) => token && token !== "and");
  if (!tokens.length) return { firsts: [], last: "" };
  if (tokens.length === 1) return { firsts: [], last: tokens[0]! };
  return { firsts: tokens.slice(0, -1), last: tokens[tokens.length - 1]! };
}

function sameFirst(a: string, b: string) {
  if (!a || !b) return false;
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  if (a === b) return true;
  if ((NICK.get(a) ?? a) === (NICK.get(b) ?? b)) return true;
  return typoClose(a, b);
}

function lastKey(value: string) {
  return value.replace(/\s+/g, "");
}

function namesEquivalent(left: string, right: string): "same" | "similar" | "" {
  const a = nameParts(left);
  const b = nameParts(right);
  if (!a.last || !b.last) return "";
  const lastSame = lastKey(a.last) === lastKey(b.last);
  const lastClose = lastSame || typoClose(lastKey(a.last), lastKey(b.last));
  if (!lastClose) return "";
  const aFirsts = a.firsts.filter((name) => name.length > 1);
  const bFirsts = b.firsts.filter((name) => name.length > 1);
  if (!aFirsts.length || !bFirsts.length) {
    // "Mr. Alterman" vs "Allan Alterman": last name only on one side is not enough alone.
    return "";
  }
  const firstHit = aFirsts.some((first) => bFirsts.some((other) => sameFirst(first, other)));
  if (!firstHit) return "";
  if (lastSame && aFirsts.some((first) => bFirsts.includes(first))) return "same";
  return "similar";
}

function phones(side: DupSide) {
  const keys = new Set<string>();
  for (const person of side.people) {
    for (const value of [person.phone, person.phone2, person.phone3]) {
      const key = phoneKey(value ?? "");
      if (key) keys.add(key);
    }
  }
  return keys;
}

function emails(side: DupSide) {
  return new Set(side.people.map((person) => emailKey(person.email ?? "")).filter(Boolean));
}

function shares(left: Set<string>, right: Set<string>) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function displayNames(side: DupSide) {
  return [side.household.name, ...side.people.map((person) => person.name)].filter((name) => stripTitles(name));
}

export type StreetParts = {
  house: string;
  street: string;
  compact: string;
  city: string;
  state: string;
};

function tokenStreet(value: string) {
  const trimmed = value
    .replace(/\s*[#].*$/, "")
    .replace(/\b(?:apt|apartment|unit|ste|suite|bldg|building|fl|floor|rm|room|lot|spc|space|trlr|trailer)\b.*$/i, "");
  const text = normName(trimmed).replace(/\bus\s+(?=rte|route|hwy|highway\b)/g, "");
  const tokens: string[] = [];
  for (const raw of text.split(" ").filter(Boolean)) {
    if (UNIT_WORDS.has(raw)) break;
    const mapped = STREET_SUFFIX[raw] ?? raw;
    tokens.push(mapped);
  }
  return tokens;
}

export function streetParts(side: DupSide): StreetParts {
  const raw = side.household.street ?? "";
  const tokens = tokenStreet(raw);
  let house = "";
  let rest = tokens;
  if (tokens[0] && /^\d+[a-z]?$/.test(tokens[0])) {
    house = tokens[0];
    rest = tokens.slice(1);
  }
  const street = rest.join(" ");
  return {
    house,
    street,
    compact: street.replace(/\s+/g, ""),
    city: normName(side.household.city ?? ""),
    state: normalizeState(side.household.state ?? "").toLowerCase(),
  };
}

function samePlace(a: StreetParts, b: StreetParts) {
  if (a.city && b.city && a.city !== b.city) return false;
  if (a.state && b.state && a.state !== b.state) return false;
  return true;
}

function addressMatch(a: StreetParts, b: StreetParts): "same address" | "similar address" | "" {
  if (!samePlace(a, b)) return "";
  if (a.house && b.house && a.compact && b.compact) {
    if (a.house !== b.house) return "";
    if (a.compact === b.compact) return "same address";
    if (typoClose(a.compact, b.compact)) return "similar address";
    return "";
  }
  // Both lack a house number, but the compact street (e.g. a named building) matches.
  if (!a.house && !b.house && a.compact && b.compact && a.compact === b.compact) return "same address";
  return "";
}

/** The matching parts, strongest first, e.g. ["same address", "same phone", "similar name"]. */
export function matchParts(a: DupSide, b: DupSide): MatchPart[] {
  const parts: MatchPart[] = [];
  const address = addressMatch(streetParts(a), streetParts(b));
  if (address) parts.push(address);
  if (shares(phones(a), phones(b))) parts.push("same phone");
  if (shares(emails(a), emails(b))) parts.push("same email");
  const an = displayNames(a);
  const bn = displayNames(b);
  let nameKind: "same name" | "similar name" | "" = "";
  for (const left of an) {
    for (const right of bn) {
      const kind = namesEquivalent(left, right);
      if (kind === "same") {
        nameKind = "same name";
        break;
      }
      if (kind === "similar" && !nameKind) nameKind = "similar name";
    }
    if (nameKind === "same name") break;
  }
  if (nameKind) parts.push(nameKind);
  return parts;
}

/**
 * Flag on same/similar address, same phone, same email, or a similar name
 * when the addresses do not clearly conflict.
 */
export function worthFlagging(parts: string[], a: DupSide, b: DupSide) {
  if (parts.some((part) => part === "same address" || part === "similar address" || part === "same phone" || part === "same email")) {
    return true;
  }
  if (!parts.includes("same name") && !parts.includes("similar name")) return false;
  const left = streetParts(a);
  const right = streetParts(b);
  // A missing street on one side is still worth flagging (e.g. Vivienne Sohn).
  if (!left.house || !right.house || !left.compact || !right.compact) return true;
  // Both have a real address and they did not match, so the similar name alone is not enough.
  return false;
}

const WEIGHT: Record<string, number> = {
  "same address": 50,
  "similar address": 45,
  "same phone": 80,
  "same email": 70,
  "same name": 60,
  "similar name": 40,
};

export function matchScore(parts: string[]) {
  return parts.reduce((sum, part) => sum + (WEIGHT[part] ?? 0), 0);
}

function join(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "Same address as", "Similar name to", or "" when nothing matches. */
export function reasonLead(parts: string[]) {
  if (!parts.length) return "";
  if (parts.length === 1 && parts[0] === "similar name") return "Similar name to";
  if (parts.length === 1 && parts[0] === "similar address") return "Similar address as";
  if (parts.every((part) => part.startsWith("similar "))) return `Similar ${join(parts.map((part) => part.replace(/^similar /, "")))} as`;
  return `Same ${join(parts.map((part) => part.replace(/^same /, "")))} as`;
}

export type LiveDupMatch = {
  matchId: string;
  parts: MatchPart[];
  reason: string;
};

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function asDupSide(household: DupPlace, people: DupPerson[] = []): DupSide {
  return { household, people };
}

/**
 * Live-book scan: every visible, non-deleted household is compared with the others.
 * Pairs marked "Not a duplicate" are skipped. Nothing is written.
 */
export function findLiveDuplicates(
  households: Array<DupPlace & { id: string }>,
  peopleBy: Map<string, DupPerson[]>,
  notDuplicatePairs: Iterable<string> = [],
): Map<string, LiveDupMatch> {
  const notDup = new Set(notDuplicatePairs);
  const live = households.filter((household) => !household.deletedAt);
  const best = new Map<string, { matchId: string; parts: MatchPart[]; score: number }>();
  const consider = (id: string, otherId: string, parts: MatchPart[], score: number) => {
    const current = best.get(id);
    if (!current || score > current.score || (score === current.score && otherId < current.matchId)) {
      best.set(id, { matchId: otherId, parts, score });
    }
  };
  for (let i = 0; i < live.length; i++) {
    const left = live[i]!;
    const leftSide = asDupSide(left, peopleBy.get(left.id) ?? []);
    for (let j = i + 1; j < live.length; j++) {
      const right = live[j]!;
      if (notDup.has(pairKey(left.id, right.id))) continue;
      const rightSide = asDupSide(right, peopleBy.get(right.id) ?? []);
      const parts = matchParts(leftSide, rightSide);
      if (!worthFlagging(parts, leftSide, rightSide)) continue;
      const score = matchScore(parts);
      consider(left.id, right.id, parts, score);
      consider(right.id, left.id, parts, score);
    }
  }
  const matches = new Map<string, LiveDupMatch>();
  for (const [id, item] of best) {
    matches.set(id, { matchId: item.matchId, parts: item.parts, reason: reasonLead(item.parts) });
  }
  return matches;
}
