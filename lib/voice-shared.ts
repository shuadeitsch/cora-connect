export const CALLER_ID = "+12079772968";

export const CALL_OUTCOMES = [
  { value: "answered", label: "Answered" },
  { value: "no_answer", label: "No answer" },
  { value: "left_voicemail", label: "Left voicemail" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "busy", label: "Busy" },
  { value: "not_interested", label: "Not interested" },
  { value: "call_back_later", label: "Call back later" },
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number]["value"];

export function outcomeLabel(value: string | null | undefined): string {
  return CALL_OUTCOMES.find((item) => item.value === value)?.label ?? "No outcome saved";
}

/** Suggest an outcome from what Twilio reported, when it is obvious. */
export function suggestOutcome(status: string, durationSeconds: number | null): CallOutcome | "" {
  if (status === "no-answer" || status === "canceled") return "no_answer";
  if (status === "busy") return "busy";
  if (status === "completed" && (durationSeconds ?? 0) > 0) return "answered";
  return "";
}

export function dialNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10 && value.trim().startsWith("+")) return `+${digits}`;
  return null;
}

export type CallRow = {
  id: string;
  householdId: string | null;
  direction: "outbound" | "inbound";
  contactNumber: string;
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  hasRecording: boolean;
  voicemail: boolean;
  outcome: string | null;
  notes: string;
  sid: string;
  contactName?: string;
};

export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
