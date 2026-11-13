import { NextResponse } from "next/server";
import { syncGmailAccounts } from "@/lib/gmail-sync";
import { messagingIngestKey } from "@/lib/messaging-status";

export const runtime = "nodejs";

/** Google Pub/Sub push endpoint. Also accepts a manual Bearer sync. */
export async function POST(req: Request) {
  const key = messagingIngestKey();
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const isGoogle = Boolean(req.headers.get("x-goog-channel-id") || req.headers.get("x-goog-resource-state"));
  if (!isGoogle && !(key && bearer === key)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await syncGmailAccounts();
  return NextResponse.json({ ok: true, accounts: result.accounts, ingested: result.ingested });
}
