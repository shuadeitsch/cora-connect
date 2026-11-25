import { after, NextResponse } from "next/server";
import { bulkSendUser, createBulkSendJob, getBulkSendJob, listBulkSendJobs, runBulkSendJob, type BulkSendItem } from "@/lib/bulk-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const noStore = { headers: { "Cache-Control": "no-store" } };

/** Running bulk sends for the tracker, or one job with its results (?id=). */
export async function GET(req: Request) {
  const gate = await bulkSendUser();
  if (!gate.ok) return NextResponse.json({ jobs: [], enabled: false }, noStore);
  const id = new URL(req.url).searchParams.get("id");
  if (id) return NextResponse.json({ job: await getBulkSendJob(id) }, noStore);
  return NextResponse.json({ jobs: await listBulkSendJobs(gate.user), enabled: true }, noStore);
}

/** Start a bulk send. It runs on the server, so the sender can close the window. */
export async function POST(req: Request) {
  const gate = await bulkSendUser();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  let body: { label?: string; items?: BulkSendItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  try {
    const id = await createBulkSendJob(gate.user, body.label ?? "", items);
    after(() => runBulkSendJob(gate.user, id));
    return NextResponse.json({ ok: true, id }, noStore);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Could not start the send." }, { status: 400 });
  }
}
