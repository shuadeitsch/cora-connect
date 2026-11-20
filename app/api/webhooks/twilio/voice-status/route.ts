import { NextResponse } from "next/server";
import { upsertCall, verifiedParams } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Call status events (both legs) and recording-ready events. Always 200 once the signature is valid. */
export async function POST(req: Request) {
  const params = await verifiedParams(req, "/api/webhooks/twilio/voice-status");
  if (!params) return new NextResponse("Forbidden", { status: 403 });
  const now = new Date().toISOString();

  if (params.RecordingSid) {
    if ((params.RecordingStatus || "completed") === "completed" && params.CallSid) {
      await upsertCall({
        sid: params.CallSid,
        recording_sid: params.RecordingSid,
        recording_url: params.RecordingUrl || "",
        recording_duration: params.RecordingDuration || "",
      });
    }
    return new NextResponse("OK");
  }

  const status = params.CallStatus || "";
  const parent = params.ParentCallSid || "";
  if (parent) {
    // The leg to the contact: this is the one that says whether they answered.
    const patch: Record<string, unknown> = { sid: parent, status };
    if (status === "in-progress") patch.answered_at = now;
    if (["completed", "busy", "no-answer", "failed", "canceled"].includes(status)) {
      patch.ended_at = now;
      if (status === "completed") patch.duration = params.CallDuration || "";
    }
    await upsertCall(patch);
  } else if (params.CallSid && ["completed", "failed", "canceled"].includes(status)) {
    await upsertCall({ sid: params.CallSid, ended_at: now });
  }
  return new NextResponse("OK");
}
