"use server";

import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** Save Tutorial resume point. Never writes in Beta preview. Does not touch other profile fields. */
export async function saveTutorialProgressAction(input: {
  step: number;
  done: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Sign in again." };
  const step = Number.isFinite(input.step) ? Math.max(0, Math.floor(input.step)) : 0;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ tutorial_step: step, tutorial_done: Boolean(input.done) })
    .eq("id", user.id);
  if (error) return { ok: false as const, error: "Could not save your tutorial place." };
  return { ok: true as const };
}
