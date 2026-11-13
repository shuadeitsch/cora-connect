import { NextResponse } from "next/server";
import { syncGmailAccounts } from "@/lib/gmail-sync";
import { messagingIngestKey } from "@/lib/messaging-status";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const key = messagingIngestKey();
  const cron = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (cron && bearer === cron) return true;
  if (key && bearer === key) return true;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await syncGmailAccounts();
  return NextResponse.json({ ok: true, accounts: result.accounts, ingested: result.ingested, errors: result.errors });
}

export async function POST(req: Request) {
  return GET(req);
}
