import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { diagnoseGmail } from "@/lib/gmail-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// TEMPORARY diagnostic: counts and reasons only, no bodies, no tokens. Gated by a hash baked in here.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (createHash("sha256").update(bearer).digest("hex") !== "55aeaf12c9c07602d47ea1447c681c431fa20ff6d2cd65534226c87c66aa2310") return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json(await diagnoseGmail());
}
