import { NextResponse } from "next/server";
import { estimateDaysLeft, getTwilioLive, loadAdminTables, requireTwilioAdmin } from "@/lib/twilio-admin";

export const dynamic = "force-dynamic";

/** Admin-only. Anyone else gets 403 (or 401 signed out) and Twilio is never called. */
export async function GET() {
  const access = await requireTwilioAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: { "Cache-Control": "no-store" } });
  const [live, tables] = await Promise.all([getTwilioLive(), loadAdminTables()]);
  return NextResponse.json({ live, estimate: estimateDaysLeft(live), ...tables }, { headers: { "Cache-Control": "private, no-store" } });
}
