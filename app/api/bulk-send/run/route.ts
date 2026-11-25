import { after, NextResponse } from "next/server";
import { bulkSendUser, runBulkSendJob, takeBulkSendJob } from "@/lib/bulk-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Resume a bulk send whose worker stopped (time limit or restart). Does nothing if a worker is still sending. */
export async function POST(req: Request) {
  const gate = await bulkSendUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Missing job." }, { status: 400 });
  const took = await takeBulkSendJob(id);
  if (took) after(() => runBulkSendJob(gate.user, id));
  return NextResponse.json({ ok: true, resumed: took }, { headers: { "Cache-Control": "no-store" } });
}
