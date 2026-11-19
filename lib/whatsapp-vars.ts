/** Helpers for WhatsApp Content templates with more than one variable. Safe for client and server. */

/** Variable keys ("1", "2", ...) used in a template body, sorted numerically. */
export function templateVarKeys(body: string, declared: string[] = []): string[] {
  const keys = new Set<string>(declared.filter((key) => /^\d+$/.test(key)));
  for (const match of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) keys.add(match[1]);
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

export function fillTemplateBody(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, key: string) => (vars[key] !== undefined && vars[key] !== "" ? vars[key] : whole));
}

export function townFromCity(city: string | null | undefined): string {
  return (city ?? "").trim().replace(/\s+/g, " ");
}

const STATE_ZONES: Record<string, string> = {
  WI: "America/Chicago",
  WISCONSIN: "America/Chicago",
};

/** "Tuesday, December 8 at 2 PM" in the visit state's time zone (ME/NH default to New York). */
export function visitWhenFromScheduled(scheduledAt: string | null | undefined, state?: string | null): string {
  if (!scheduledAt) return "";
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return "";
  const timeZone = STATE_ZONES[(state ?? "").trim().toUpperCase()] ?? "America/New_York";
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" }).format(date);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const ampm = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  const atMidnight = hour === "12" && minute === "00" && ampm === "AM";
  if (atMidnight) return day;
  return `${day} at ${hour}${minute === "00" ? "" : `:${minute}`} ${ampm}`;
}
