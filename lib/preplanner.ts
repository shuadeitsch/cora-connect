export const PREPLANNER_REACHED = [
  { id: "email", label: "Email" },
  { id: "text", label: "Text" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "Phone call" },
  { id: "in_person", label: "In person" },
  { id: "other", label: "Other" },
] as const;

export type PreplannerReachedHow = (typeof PREPLANNER_REACHED)[number]["id"];

export function parseReachedHow(value: string): PreplannerReachedHow {
  return PREPLANNER_REACHED.some((item) => item.id === value) ? (value as PreplannerReachedHow) : "other";
}

export function parseReachedHows(value: unknown): PreplannerReachedHow[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,|]+/)
      : [];
  const out: PreplannerReachedHow[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !item.trim()) continue;
    const id = parseReachedHow(item.trim());
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function reachedHowLabel(value: string | string[] | null | undefined): string {
  const ids = parseReachedHows(Array.isArray(value) ? value : value ? [value] : []);
  if (!ids.length) return "";
  return ids.map((id) => PREPLANNER_REACHED.find((item) => item.id === id)?.label ?? "Other").join(", ");
}

export function normalizeRequestedTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function preplannerWhen(date: string, time: string): string {
  const day = new Date(`${date}T12:00:00`);
  const dateLabel = Number.isNaN(day.getTime())
    ? date
    : day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const normalized = normalizeRequestedTime(time) ?? time;
  const [hour, minute] = normalized.split(":").map(Number);
  const clock = new Date(2000, 0, 1, hour ?? 0, minute ?? 0);
  const timeLabel = clock.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} at ${timeLabel}`;
}

export function preplannerSortKey(date: string, time: string): string {
  return `${date}T${normalizeRequestedTime(time) ?? "99:99"}`;
}

export type PreplannerStage = "reached_out" | "confirmed";

export type PreplannerNote = { at: string; text: string; by?: string | null };

export function parseStage(value: string | null | undefined): PreplannerStage {
  return value === "confirmed" ? "confirmed" : "reached_out";
}

export function parseNotesLog(value: unknown, fallback = ""): PreplannerNote[] {
  if (Array.isArray(value)) {
    const out: PreplannerNote[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const row = item as { at?: unknown; text?: unknown; by?: unknown };
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (!text) continue;
      out.push({
        at: typeof row.at === "string" && row.at ? row.at : new Date().toISOString(),
        text,
        by: typeof row.by === "string" ? row.by : null,
      });
    }
    return out;
  }
  if (fallback.trim()) return [{ at: new Date().toISOString(), text: fallback.trim(), by: null }];
  return [];
}

export function appendNote(log: PreplannerNote[], text: string, by?: string | null): PreplannerNote[] {
  const trimmed = text.trim();
  if (!trimmed) return log;
  return [...log, { at: new Date().toISOString(), text: trimmed, by: by ?? null }];
}

export function notesLogText(log: PreplannerNote[]): string {
  return log.map((item) => item.text).join("\n\n");
}

export function chanukahProjectId(projects: { id: string; name: string }[]): string | null {
  return projects.find((project) => project.name.trim() === "Chanukah 5787")?.id ?? null;
}

export function defaultPreplannerProjectId(projects: { id: string; name: string }[]): string {
  return chanukahProjectId(projects) ?? projects[0]?.id ?? "";
}

export function preplannerCounts(
  entries: { stage?: string; projectId?: string | null; householdId: string }[],
  households: { id: string; state: string }[],
  filters: { projectId?: string; state?: string },
): { reachedOut: number; confirmed: number } {
  const byId = new Map(households.map((household) => [household.id, household]));
  const projectId = filters.projectId && filters.projectId !== "ALL" ? filters.projectId : "";
  const state = (filters.state && filters.state !== "ALL" ? filters.state : "").toUpperCase();
  const stateAliases: Record<string, string> = { MAINE: "ME", "NEW HAMPSHIRE": "NH", WISCONSIN: "WI", ME: "ME", NH: "NH", WI: "WI" };
  const wanted = state ? (stateAliases[state] ?? state) : "";
  let reachedOut = 0;
  let confirmed = 0;
  for (const entry of entries) {
    if (projectId && entry.projectId !== projectId) continue;
    const household = byId.get(entry.householdId);
    if (wanted) {
      const raw = (household?.state || "").toUpperCase();
      const code = stateAliases[raw] ?? raw;
      if (code !== wanted && raw !== wanted) continue;
    }
    if (parseStage(entry.stage) === "confirmed") confirmed += 1;
    else reachedOut += 1;
  }
  return { reachedOut, confirmed };
}
