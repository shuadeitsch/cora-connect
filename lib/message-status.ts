/** Plain-language label, color and reason for a logged message's delivery status. */
export type MessageStatusInfo = { label: string; tone: "ok" | "bad" | "pending"; reason: string };

const REASONS: Record<string, string> = {
  "63049": "WhatsApp (Meta) didn't deliver this marketing message.",
  "63016": "Outside WhatsApp's 24-hour reply window. Use an approved template.",
  "63112": "WhatsApp (Meta) disabled this recipient's number for messages.",
  "63024": "That isn't a valid WhatsApp number.",
  "63003": "That number isn't on WhatsApp.",
  "63018": "WhatsApp rate limit reached. Try again later.",
  "63051": "WhatsApp number setup problem on the sender side.",
  "63007": "The WhatsApp sender isn't set up correctly.",
  "21211": "That phone number isn't valid.",
  "21610": "The recipient opted out of texts.",
  "21614": "That number can't receive texts.",
  "30003": "The phone was unreachable or switched off.",
  "30005": "That number doesn't exist.",
  "30006": "That number is a landline or can't get texts.",
  "30007": "The carrier blocked the text as spam.",
};

export function errorCodeOf(error: string | null | undefined): string {
  return /\b(\d{4,5})\b/.exec(error ?? "")?.[1] ?? "";
}

export function describeMessageStatus(status: string, error?: string | null): MessageStatusInfo {
  const s = (status || "").toLowerCase();
  if (s === "failed" || s === "undelivered") {
    const code = errorCodeOf(error);
    const reason = (code && REASONS[code]) || (error && !/^\d+$/.test(error.trim()) ? error : "") || "The message couldn't be delivered.";
    return { label: "Failed", tone: "bad", reason: code ? `${reason} (code ${code})` : reason };
  }
  if (s === "read") return { label: "Read", tone: "ok", reason: "" };
  if (s === "delivered") return { label: "Delivered", tone: "ok", reason: "" };
  if (s === "queued") return { label: "Sending", tone: "pending", reason: "" };
  if (s === "sent") return { label: "Sent", tone: "pending", reason: "Handed to the carrier; delivery not confirmed yet." };
  if (s === "skipped") return { label: "Skipped", tone: "pending", reason: error || "" };
  return { label: s || "", tone: "pending", reason: "" };
}
