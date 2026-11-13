import { NextResponse } from "next/server";
import { syncGmailAccountsForCaller } from "@/lib/gmail-sync";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = await assertNotPreview();
  if (!gate.ok) return NextResponse.json({ ok: false, error: "Preview cannot sync." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await syncGmailAccountsForCaller({ force });
  return NextResponse.json({ ok: true, ...result });
}
