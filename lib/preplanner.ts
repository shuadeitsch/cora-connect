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

export function reachedHowLabel(value: string): string {
  return PREPLANNER_REACHED.find((item) => item.id === value)?.label ?? "Other";
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
