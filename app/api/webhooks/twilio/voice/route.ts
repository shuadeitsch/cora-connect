import { NextResponse } from "next/server";
import { CALLER_ID, esc, siteOrigin, upsertCall, verifiedParams, voiceRpc, xml } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/webhooks/twilio/voice";
const NOTICE = "This call may be recorded.";

type Resolved = { org_id: string; household_id: string | null; person_id: string | null; name: string | null };

export async function POST(req: Request) {
  const params = await verifiedParams(req, PATH);
  if (!params) return new NextResponse("Forbidden", { status: 403 });
  const step = new URL(req.url).searchParams.get("step") || "";
  const origin = await siteOrigin();
  const statusUrl = `${origin}/api/webhooks/twilio/voice-status`;
  const callSid = params.CallSid || "";

  // Plays to the person we dialled, after they answer and before they are connected.
  if (step === "notice") return xml(`<Say voice="Polly.Joanna">${esc(NOTICE)}</Say>`);

  // Dial finished (outbound or inbound ring).
  if (step === "dialed") return xml("");
  if (step === "inbound-done") {
    const status = params.DialCallStatus || "";
    if (status === "completed") {
      const dur = Number(params.DialCallDuration || 0);
      await upsertCall({ sid: callSid, status: "completed", duration: String(dur), answered_at: new Date(Date.now() - dur * 1000).toISOString(), ended_at: new Date().toISOString() });
      return xml("");
    }
    await upsertCall({ sid: callSid, status: "no-answer", voicemail: true });
    return xml(
      `<Say voice="Polly.Joanna">Thank you for calling Chabad of Maine. Nobody can take your call right now. Please leave a message after the tone.</Say>` +
        `<Record maxLength="120" playBeep="true" recordingStatusCallback="${statusUrl}" recordingStatusCallbackEvent="completed"/>` +
        `<Say voice="Polly.Joanna">Goodbye.</Say>`,
    );
  }

  const from = params.From || "";
  if (from.startsWith("client:")) {
    // Outbound call placed from the CRM in a browser.
    const userId = from.slice("client:".length);
    const to = params.To || "";
    const resolved = await voiceRpc<Resolved[]>("voice_resolve_outbound", { p_user: userId, p_number: to });
    const match = resolved?.[0];
    if (!match || !/^\+\d{10,15}$/.test(to)) {
      return xml(`<Say voice="Polly.Joanna">Sorry, that number is not saved on a contact, so the call cannot be placed.</Say><Hangup/>`);
    }
    await upsertCall({
      sid: callSid,
      org_id: match.org_id,
      household_id: match.household_id,
      person_id: match.person_id,
      user_id: userId,
      direction: "outbound",
      from_number: CALLER_ID,
      to_number: to,
      contact_number: to,
      status: "initiated",
    });
    return xml(
      `<Dial callerId="${CALLER_ID}" answerOnBridge="true" timeout="45" record="record-from-answer-dual" recordingStatusCallback="${statusUrl}" recordingStatusCallbackEvent="completed" action="${origin}${PATH}?step=dialed">` +
        `<Number url="${origin}${PATH}?step=notice" statusCallback="${statusUrl}" statusCallbackEvent="initiated ringing answered completed">${esc(to)}</Number></Dial>`,
    );
  }

  // Inbound call to the Cora number.
  const info = await voiceRpc<{ org_id: string; household_id?: string; person_id?: string; name?: string; ring: string[] }>("voice_resolve_inbound", { p_from: from, p_to: params.To || CALLER_ID });
  if (info?.org_id) {
    await upsertCall({
      sid: callSid,
      org_id: info.org_id,
      household_id: info.household_id ?? "",
      person_id: info.person_id ?? "",
      direction: "inbound",
      from_number: from,
      to_number: params.To || CALLER_ID,
      contact_number: from,
      status: "ringing",
    });
  }
  const ring = (info?.ring ?? []).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 10);
  if (!ring.length) {
    await upsertCall({ sid: callSid, status: "no-answer", voicemail: true });
    return xml(
      `<Say voice="Polly.Joanna">Thank you for calling Chabad of Maine. Nobody can take your call right now. Please leave a message after the tone.</Say>` +
        `<Record maxLength="120" playBeep="true" recordingStatusCallback="${statusUrl}" recordingStatusCallbackEvent="completed"/><Say voice="Polly.Joanna">Goodbye.</Say>`,
    );
  }
  return xml(
    `<Say voice="Polly.Joanna">${esc(NOTICE)}</Say>` +
      `<Dial timeout="25" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${statusUrl}" recordingStatusCallbackEvent="completed" action="${origin}${PATH}?step=inbound-done">` +
      ring.map((id) => `<Client>${esc(id)}</Client>`).join("") +
      `</Dial>`,
  );
}
