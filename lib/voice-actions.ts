"use server";

import { createClient } from "@/lib/supabase/server";
import { CALL_OUTCOMES, type CallRow } from "@/lib/voice-shared";

type Row = {
  id: string; household_id: string | null; direction: "outbound" | "inbound"; contact_number: string; status: string; started_at: string;
  duration_seconds: number | null; recording_sid: string | null; voicemail: boolean; outcome: string | null; notes: string; twilio_call_sid: string;
};
const COLS = "id, household_id, direction, contact_number, status, started_at, duration_seconds, recording_sid, voicemail, outcome, notes, twilio_call_sid";

function map(row: Row): CallRow {
  return {
    id: row.id, householdId: row.household_id, direction: row.direction, contactNumber: row.contact_number, status: row.status,
    startedAt: row.started_at, durationSeconds: row.duration_seconds, hasRecording: Boolean(row.recording_sid), voicemail: row.voicemail,
    outcome: row.outcome, notes: row.notes ?? "", sid: row.twilio_call_sid,
  };
}

export async function listCallsAction(householdId: string): Promise<CallRow[]> {
  if (!/^[0-9a-f-]{36}$/i.test(householdId)) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("calls").select(COLS).eq("household_id", householdId).order("started_at", { ascending: false }).limit(50);
  return ((data ?? []) as Row[]).map(map);
}

export async function listRecentCallsAction(): Promise<CallRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("calls").select(COLS).order("started_at", { ascending: false }).limit(100);
  const rows = ((data ?? []) as Row[]).map(map);
  const ids = [...new Set(rows.map((row) => row.householdId).filter((id): id is string => Boolean(id)))];
  if (ids.length) {
    const { data: households } = await supabase.from("households").select("id, name").in("id", ids);
    const names = new Map((households ?? []).map((item) => [item.id as string, item.name as string]));
    for (const row of rows) if (row.householdId) row.contactName = names.get(row.householdId);
  }
  return rows;
}

export async function getCallStatusAction(sid: string): Promise<{ status: string; durationSeconds: number | null } | null> {
  if (!/^CA[0-9a-f]{32}$/i.test(sid)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("calls").select("status, duration_seconds").eq("twilio_call_sid", sid).maybeSingle();
  return data ? { status: data.status as string, durationSeconds: (data.duration_seconds as number | null) ?? null } : null;
}

export async function saveCallOutcomeAction(sid: string, outcome: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^CA[0-9a-f]{32}$/i.test(sid)) return { ok: false, error: "That call was not found." };
  if (!CALL_OUTCOMES.some((item) => item.value === outcome)) return { ok: false, error: "Pick what happened on the call." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("calls").update({ outcome, notes: notes.trim().slice(0, 2000) }).eq("twilio_call_sid", sid).select("id");
  if (error) return { ok: false, error: "Could not save the call. Please try again." };
  if (!data?.length) return { ok: false, error: "That call is not in the log yet. Wait a few seconds and try again." };
  return { ok: true };
}
