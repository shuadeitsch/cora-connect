"use server";

import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isThemeId } from "@/lib/themes";

export async function saveThemeAction(theme: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  if (!isThemeId(theme)) return { ok: false, error: "Pick one of the themes." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ theme }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your theme. It still applies on this device." };
  return { ok: true };
}
