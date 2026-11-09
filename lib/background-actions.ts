"use server";

import { revalidatePath } from "next/cache";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; url: string | null } | { ok: false; error: string };
const BUCKET = "backgrounds";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function clearOld(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  const old = (data ?? []).map((file) => `${userId}/${file.name}`).filter((path) => path !== keep);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}

export async function uploadBackgroundAction(form: FormData): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const file = form.get("file");
  if (!(file instanceof Blob) || !file.size) return { ok: false, error: "Pick a picture." };
  if (!TYPES.has(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP picture." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, error: "That picture is too big." };
  const supabase = await createClient();
  const path = `${user.id}/bg-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
  if (error) return { ok: false, error: "Couldn't upload the picture. Try again." };
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: saveError } = await supabase.from("profiles").update({ background_url: url }).eq("id", user.id);
  if (saveError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: "Couldn't save the picture. Try again." };
  }
  await clearOld(supabase, user.id, path);
  revalidatePath("/", "layout");
  return { ok: true, url };
}

export async function removeBackgroundAction(): Promise<Result> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ background_url: null }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't remove the picture." };
  await clearOld(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}
