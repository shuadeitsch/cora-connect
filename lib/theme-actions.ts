"use server";

import { revalidatePath } from "next/cache";
import { assertNotPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isThemeId } from "@/lib/themes";
import type { PhotoThemeColors } from "@/lib/photo-theme";

function sanitizeColors(raw: unknown): PhotoThemeColors | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const str = (key: string) => (typeof row[key] === "string" && /^#[0-9a-fA-F]{6}$/.test(row[key] as string) ? (row[key] as string) : null);
  const primary = str("primary");
  const primaryForeground = str("primaryForeground");
  const accent = str("accent");
  const accentForeground = str("accentForeground");
  const background = str("background");
  const card = str("card");
  const muted = str("muted");
  const border = str("border");
  const foreground = str("foreground");
  const mutedForeground = str("mutedForeground");
  const secondary = str("secondary");
  if (!primary || !primaryForeground || !accent || !accentForeground || !background || !card || !muted || !border || !foreground || !mutedForeground || !secondary) {
    return null;
  }
  const dark = Boolean(row.dark);
  const overlay = typeof row.overlay === "number" && Number.isFinite(row.overlay) ? Math.min(0.9, Math.max(0.4, row.overlay)) : 0.78;
  return { primary, primaryForeground, accent, accentForeground, background, card, muted, border, foreground, mutedForeground, secondary, dark, overlay };
}

export async function saveThemeAction(theme: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  if (!isThemeId(theme)) return { ok: false, error: "Pick one of the themes." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const supabase = await createClient();
  // Picking a preset turns off photo-match so the swatch they chose wins.
  const { error } = await supabase
    .from("profiles")
    .update({ theme, theme_match_photo: false, theme_colors: null })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your theme. It still applies on this device." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveThemeMatchAction(input: {
  match: boolean;
  colors?: PhotoThemeColors | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const previewGate = await assertNotPreview();
  if (!previewGate.ok) return previewGate;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const supabase = await createClient();
  if (!input.match) {
    const { error } = await supabase.from("profiles").update({ theme_match_photo: false, theme_colors: null }).eq("id", user.id);
    if (error) return { ok: false, error: "Couldn't save." };
    revalidatePath("/", "layout");
    return { ok: true };
  }
  const colors = sanitizeColors(input.colors);
  if (!colors) return { ok: false, error: "Couldn't read colors from that picture." };
  const { error } = await supabase.from("profiles").update({ theme_match_photo: true, theme_colors: colors }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save." };
  revalidatePath("/", "layout");
  return { ok: true };
}
