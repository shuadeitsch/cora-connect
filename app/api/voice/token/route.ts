import { NextResponse } from "next/server";
import { canMessageRole, MESSAGING_BLOCKED_MESSAGE } from "@/lib/messaging-access";
import { createClient } from "@/lib/supabase/server";
import { mintVoiceToken, voiceConfigured } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!voiceConfigured()) return NextResponse.json({ error: "Calling is not set up yet." }, { status: 503 });
  const profile = await supabase.from("profiles").select("status, role").eq("id", data.user.id).maybeSingle();
  if (profile.data?.status !== "approved") return NextResponse.json({ error: "Your account is not approved for calling." }, { status: 403 });
  if (!canMessageRole(profile.data?.role)) return NextResponse.json({ error: MESSAGING_BLOCKED_MESSAGE }, { status: 403 });
  await supabase.rpc("voice_client_seen");
  const ttl = 3600;
  return NextResponse.json({ token: mintVoiceToken(data.user.id, ttl), identity: data.user.id, expiresIn: ttl }, { headers: { "Cache-Control": "no-store" } });
}
