/** Seasons stored in the existing Visited text. Other is a season, not a free-text escape. */
export const VISIT_SEASONS = ["Summer", "Chanukah", "Pesach", "Tishrei", "Purim", "Other"] as const;

export type VisitSeason = (typeof VISIT_SEASONS)[number];

const SEASON_PATTERN = VISIT_SEASONS.join("|");

/**
 * Visited stays one text column. A picked season and year are stored as
 * "Summer 5786" (season, one space, four-digit Hebrew year).
 * Text that is not that shape is left unchanged until someone picks a season.
 */
export function formatVisited(season: string, year: string): string {
  const name = VISIT_SEASONS.find((item) => item.toLowerCase() === season.trim().toLowerCase());
  const digits = year.trim();
  if (!name || !/^\d{4}$/.test(digits)) return "";
  return `${name} ${digits}`;
}

export function parseVisited(value: string): { season: VisitSeason | ""; year: string; raw: string } {
  const raw = value.trim();
  const match = raw.match(new RegExp(`^(${SEASON_PATTERN})\\s+(\\d{4})$`, "i"));
  if (!match) return { season: "", year: "", raw };
  const season = VISIT_SEASONS.find((item) => item.toLowerCase() === match[1]!.toLowerCase()) ?? "";
  return { season, year: match[2] ?? "", raw: "" };
}

/** Hebrew year in America/New_York, so the year changes on the US evening of Rosh Hashanah. */
export function currentHebrewYear(now = new Date()): number {
  const formatted = new Intl.DateTimeFormat("en-US-u-ca-hebrew", {
    timeZone: "America/New_York",
    year: "numeric",
  }).format(now);
  const match = formatted.match(/\d{4}/);
  return match ? Number(match[0]) : 5787;
}

/** Current Hebrew year, two years before it, and two years after it, plus any year already stored. */
export function hebrewYearChoices(now = new Date(), extra: number[] = []): number[] {
  const current = currentHebrewYear(now);
  const years = new Set<number>(extra.filter((year) => Number.isInteger(year)));
  for (let offset = -2; offset <= 2; offset += 1) years.add(current + offset);
  return [...years].filter((year) => year >= 5700 && year <= 6000).sort((a, b) => a - b);
}
