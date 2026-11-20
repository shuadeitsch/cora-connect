import { NextResponse } from "next/server";
import { canMessageRole } from "@/lib/messaging-access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Light poll for the Inbox badge: total unread and the newest unread thread. Admin-only, like messaging. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const profile = await supabase.from("profiles").select("status, role").eq("id", data.user.id).maybeSingle();
  if (profile.data?.status !== "approved" || !canMessageRole(profile.data?.role)) {
    return NextResponse.json({ count: 0, enabled: false }, { headers: { "Cache-Control": "no-store" } });
  }
  const { data: rows, error } = await supabase
    .from("message_threads")
    .select("id, household_id, channel_type, unread_count, last_inbound_at")
    .gt("unread_count", 0)
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "Could not check messages." }, { status: 500 });
  const list = rows ?? [];
  const count = list.reduce((sum, row) => sum + (Number(row.unread_count) || 0), 0);
  let latest: { threadId: string; at: string | null; name: string; channel: string } | null = null;
  if (list[0]) {
    const house = await supabase.from("households").select("name").eq("id", list[0].household_id).maybeSingle();
    latest = { threadId: String(list[0].id), at: list[0].last_inbound_at ? String(list[0].last_inbound_at) : null, name: String(house.data?.name ?? "A contact"), channel: String(list[0].channel_type) };
  }
  return NextResponse.json({ count, enabled: true, latest }, { headers: { "Cache-Control": "no-store" } });
}
