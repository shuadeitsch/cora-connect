import "server-only";
import { decryptSecret } from "@/lib/mail-crypto";
import { gmailAccessToken } from "@/lib/mail-send";
import { messagingIngestKey } from "@/lib/messaging-status";
import { createEphemeralClient } from "@/lib/supabase/server";

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };

function textOf(part: Part | undefined): string {
  if (!part) return "";
  let out = "";
  if (part.body?.data && /^text\//.test(part.mimeType ?? "") || (part.body?.data && (part.mimeType ?? "").includes("delivery-status"))) {
    out += Buffer.from(part.body!.data!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") + "\n";
  }
  for (const child of part.parts ?? []) out += textOf(child);
  return out;
}

export async function listBounces() {
  const key = messagingIngestKey();
  if (!key) return { error: "no key" };
  const supabase = createEphemeralClient();
  const listed = await supabase.rpc("gmail_sync_accounts", { p_key: key });
  const account = (listed.data as { refresh_token_cipher: string; refresh_token_iv: string }[] | null)?.[0];
  if (!account) return { error: "no account" };
  const access = await gmailAccessToken(decryptSecret(account.refresh_token_cipher, account.refresh_token_iv));
  const get = async (path: string) => (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, { headers: { Authorization: `Bearer ${access}` } })).json();
  const q = "(from:mailer-daemon OR from:postmaster OR subject:\"Delivery Status Notification\" OR subject:undeliverable OR subject:\"Mail Delivery\" OR subject:\"Returned mail\" OR subject:\"failure notice\") newer_than:3d";
  const list = (await get(`/messages?q=${encodeURIComponent(q)}&maxResults=200`)) as { messages?: { id: string }[] };
  const rows: unknown[] = [];
  for (const item of list.messages ?? []) {
    const m = (await get(`/messages/${item.id}?format=full`)) as { internalDate?: string; labelIds?: string[]; payload?: Part & { headers?: { name: string; value: string }[] } };
    const text = textOf(m.payload);
    const subject = m.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
    const recips = new Set<string>();
    for (const x of text.matchAll(/Final-Recipient:\s*rfc822;\s*([^\s<>]+)/gi)) recips.add(x[1].toLowerCase());
    for (const x of text.matchAll(/X-Failed-Recipients:\s*([^\s<>,]+)/gi)) recips.add(x[1].toLowerCase());
    if (!recips.size) for (const x of text.matchAll(/(?:delivered to|sent to|address)\s+<?([\w.+-]+@[\w.-]+\.[a-z]{2,})>?/gi)) recips.add(x[1].toLowerCase());
    const status = (text.match(/^Status:\s*([245]\.\d+\.\d+)/im) ?? [])[1] ?? "";
    const action = (text.match(/^Action:\s*(\w+)/im) ?? [])[1] ?? "";
    const diag = ((text.match(/^Diagnostic-Code:\s*(.+)$/im) ?? [])[1] ?? (text.match(/(550[^\n]{0,140}|554[^\n]{0,140}|552[^\n]{0,140}|451[^\n]{0,140}|452[^\n]{0,140})/) ?? [])[1] ?? "").slice(0, 160);
    rows.push({
      id: item.id,
      at: new Date(Number(m.internalDate ?? 0)).toISOString(),
      labels: (m.labelIds ?? []).join(","),
      subject: subject.slice(0, 70),
      recipients: [...recips],
      status,
      action,
      diag,
      snippet: recips.size ? "" : text.replace(/\s+/g, " ").slice(0, 200),
    });
  }
  return { count: rows.length, rows };
}
