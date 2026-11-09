"use server";

import { revalidatePath } from "next/cache";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export type SuggestionChange = { field: string; old: string; new: string };

export type ContactEditSuggestion = {
  id: string;
  householdId: string;
  householdName: string;
  bochurId: string;
  bochurName: string;
  changes: SuggestionChange[];
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  state: string;
};

export async function submitContactEditSuggestionAction(input: {
  householdId: string;
  changes: SuggestionChange[];
  note?: string;
}): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user || user.role !== "bochur") return { ok: false, error: "Only a bochur can suggest edits." };
  if (!input.householdId) return { ok: false, error: "Pick a contact." };
  const changes = (input.changes ?? []).filter((c) => c.field && c.new !== c.old);
  if (!changes.length) return { ok: false, error: "Change at least one field." };
  const supabase = await createClient();
  const { error } = await supabase.from("contact_edit_suggestions").insert({
    org_id: user.orgId,
    household_id: input.householdId,
    bochur_id: user.id,
    changes,
    note: (input.note ?? "").trim(),
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function listPendingSuggestionsAction(state?: string): Promise<ActionResult<{ rows: ContactEditSuggestion[] }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  if (user.role !== "admin" && user.role !== "shliach") return { ok: false, error: "Not allowed." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_edit_suggestions")
    .select("id, household_id, bochur_id, changes, note, status, created_at, reviewed_by, reviewed_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return { ok: true, data: { rows: [] } };
    return { ok: false, error: error.message };
  }
  const ids = [...new Set((data ?? []).flatMap((r) => [String(r.household_id), String(r.bochur_id)]))];
  const { data: houses } = await supabase.from("households").select("id, name, state").in("id", ids);
  const { data: people } = await supabase.from("profiles").select("id, name").in("id", ids);
  const houseBy = new Map((houses ?? []).map((h) => [String(h.id), h]));
  const nameBy = new Map((people ?? []).map((p) => [String(p.id), String(p.name ?? "")]));
  const stateFilter = (state || "ALL").toUpperCase();
  const rows: ContactEditSuggestion[] = (data ?? [])
    .map((row) => {
      const house = houseBy.get(String(row.household_id));
      return {
        id: String(row.id),
        householdId: String(row.household_id),
        householdName: String(house?.name ?? "Contact"),
        bochurId: String(row.bochur_id),
        bochurName: nameBy.get(String(row.bochur_id)) || "Bochur",
        changes: Array.isArray(row.changes) ? (row.changes as SuggestionChange[]) : [],
        note: String(row.note ?? ""),
        status: "pending" as const,
        createdAt: String(row.created_at ?? ""),
        reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
        reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
        state: String(house?.state ?? ""),
      };
    })
    .filter((row) => {
      if (user.role === "admin" && stateFilter !== "ALL") {
        return row.state.toUpperCase() === stateFilter || row.state === stateFilter;
      }
      return true;
    });
  return { ok: true, data: { rows } };
}

export async function listMySuggestionsForContactAction(householdId: string): Promise<ActionResult<{ rows: ContactEditSuggestion[] }>> {
  const user = await getCurrentUser();
  if (!user || user.role !== "bochur") return { ok: true, data: { rows: [] } };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_edit_suggestions")
    .select("id, household_id, bochur_id, changes, note, status, created_at, reviewed_by, reviewed_at")
    .eq("household_id", householdId)
    .eq("bochur_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { ok: true, data: { rows: [] } };
  return {
    ok: true,
    data: {
      rows: (data ?? []).map((row) => ({
        id: String(row.id),
        householdId: String(row.household_id),
        householdName: "",
        bochurId: String(row.bochur_id),
        bochurName: user.name,
        changes: Array.isArray(row.changes) ? (row.changes as SuggestionChange[]) : [],
        note: String(row.note ?? ""),
        status: String(row.status) as ContactEditSuggestion["status"],
        createdAt: String(row.created_at ?? ""),
        reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
        reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
        state: "",
      })),
    },
  };
}

export async function approveSuggestionAction(id: string): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "shliach")) return { ok: false, error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_contact_edit_suggestion", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function rejectSuggestionAction(id: string): Promise<ActionResult> {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "shliach")) return { ok: false, error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_contact_edit_suggestion", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
