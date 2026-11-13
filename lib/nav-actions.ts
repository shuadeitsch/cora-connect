"use server";

import { revalidatePath } from "next/cache";
import { assertNotPreview } from "@/lib/preview";
import { normalizeNavOrder, sameNavOrder, DEFAULT_NAV_HREFS } from "@/lib/nav-order";
import { getCurrentUser } from "@/lib/session";
import { createClient, isSupabaseMode } from "@/lib/supabase/server";

export async function saveSidebarOrderAction(
  order: string[] | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const next = order == null ? null : normalizeNavOrder(order);
  const stored = next && sameNavOrder(next, [...DEFAULT_NAV_HREFS]) ? null : next;
  if (!isSupabaseMode()) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ sidebar_order: stored }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save the sidebar order. It still applies on this device." };
  revalidatePath("/", "layout");
  return { ok: true };
}
