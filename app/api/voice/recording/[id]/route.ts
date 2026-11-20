import { NextResponse } from "next/server";
import { canMessageRole } from "@/lib/messaging-access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams a call recording to a signed-in user who is allowed to see that call (row level security decides). Never a public Twilio URL. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Please sign in.", { status: 401 });
  const prof = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (!canMessageRole(prof.data?.role)) return new NextResponse("Not allowed.", { status: 403 });
  const { data: call } = await supabase.from("calls").select("recording_sid").eq("id", id).maybeSingle();
  const sid = call?.recording_sid;
  if (!sid || !/^RE[0-9a-f]{32}$/i.test(sid)) return new NextResponse("Not found", { status: 404 });
  const account = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!account || !token) return new NextResponse("Recordings are not available.", { status: 503 });
  const headers: Record<string, string> = { Authorization: `Basic ${Buffer.from(`${account}:${token}`).toString("base64")}` };
  const range = req.headers.get("range");
  if (range) headers.Range = range;
  const upstream = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Recordings/${sid}.mp3`, { headers });
  if (!upstream.ok && upstream.status !== 206) return new NextResponse("Recording not found.", { status: 404 });
  const out = new Headers({ "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "Accept-Ranges": "bytes" });
  for (const name of ["content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}
