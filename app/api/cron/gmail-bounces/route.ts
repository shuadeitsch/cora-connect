import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { listBounces } from "@/lib/gmail-bounces";

export const runtime = "nodejs";
export const maxDuration = 60;

// TEMPORARY read-only diagnostic: bounce recipients and reasons only. Gated by a hash baked in here.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (createHash("sha256").update(bearer).digest("hex") !== "6f1c25463a9a74686f7846c7c990ce992f93c5c08ef91c80f1d112db21644411") return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json(await listBounces());
}
