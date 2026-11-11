"use server";

import { assertNotPreview } from "@/lib/preview";
import { revalidatePath } from "next/cache";
import { parseChavrusa, type Chavrusa } from "@/lib/chavrusa";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; chavrusa: Chavrusa | null } | { ok: false; error: string };

export async function setBochurChavrusaAction(bochurId: string, chavrusa: Chavrusa | null): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "shliach")) {
    return { ok: false, error: "Only a shliach or a Cora Connect admin can assign chavrusos." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_bochur_chavrusa", {
    p_bochur: bochurId,
    p_chavrusa: chavrusa,
  });
  if (error) {
    const message = error.message || "";
    if (/own bochurim/i.test(message)) return { ok: false, error: "You can only assign chavrusos for your own bochurim." };
    if (/A, B, or empty/i.test(message)) return { ok: false, error: "Pick A, B, or leave him unassigned." };
    return { ok: false, error: "Couldn't save the chavrusa." };
  }
  revalidatePath("/settings");
  revalidatePath("/team");
  revalidatePath("/planner");
  return { ok: true, chavrusa: parseChavrusa(data) };
}
