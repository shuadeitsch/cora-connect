"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export type FeedbackRow = {
  id: string;
  userId: string;
  name: string;
  role: string;
  state: string;
  message: string;
  page: string;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
};

export async function sendFeedbackAction(message: string, page?: string): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const text = message.trim();
  if (text.length < 2) return { ok: false, error: "Write a short message first." };
  if (text.length > 4000) return { ok: false, error: "Keep feedback under 4,000 characters." };
  const hdrs = await headers();
  const referer = page?.trim() || hdrs.get("referer") || "";
  const state = user.territory.map((row) => row.state).filter(Boolean)[0] ?? "";
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    name: user.name,
    role: user.role,
    state,
    message: text,
    page: referer.slice(0, 500),
  });
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return { ok: false, error: "Feedback is not set up yet. Apply migration 022_feedback.sql." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function listFeedbackAction(): Promise<ActionResult<{ rows: FeedbackRow[] }>> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Admins only." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("id, user_id, name, role, state, message, page, created_at, read_at, archived_at")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return { ok: true, data: { rows: [] } };
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    data: {
      rows: (data ?? []).map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        name: String(row.name ?? ""),
        role: String(row.role ?? ""),
        state: String(row.state ?? ""),
        message: String(row.message ?? ""),
        page: String(row.page ?? ""),
        createdAt: String(row.created_at ?? ""),
        readAt: row.read_at ? String(row.read_at) : null,
        archivedAt: row.archived_at ? String(row.archived_at) : null,
      })),
    },
  };
}

export async function markFeedbackReadAction(id: string): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Admins only." };
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveFeedbackAction(id: string): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Admins only." };
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
