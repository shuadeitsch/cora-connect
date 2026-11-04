"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; url: string | null } | { ok: false; error: string };
const BUCKET = "avatars";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Storage rules let each person write only under avatars/<his id>/. */
async function clearOld(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  const old = (data ?? []).map((file) => `${userId}/${file.name}`).filter((path) => path !== keep);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}

export async function uploadAvatarAction(form: FormData): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const file = form.get("file");
  if (!(file instanceof Blob) || !file.size) return { ok: false, error: "Pick a picture." };
  if (!TYPES.has(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP picture." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "That picture is too big." };
  const supabase = await createClient();
  const path = `${user.id}/avatar-${Date.now()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (error) return { ok: false, error: "Couldn't upload the picture. Try again." };
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: saveError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (saveError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: "Couldn't save the picture. Try again." };
  }
  await clearOld(supabase, user.id, path);
  revalidatePath("/", "layout");
  return { ok: true, url };
}

export async function removeAvatarAction(): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't remove the picture." };
  await clearOld(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}
