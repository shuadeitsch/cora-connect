"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encodePreview, PREVIEW_COOKIE, type PreviewMode } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

export async function startPreviewAction(role: "bochur" | "shliach", state?: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { ok: false, error: "Admins only." };
  const preview: PreviewMode =
    role === "bochur" ? { role: "bochur" } : { role: "shliach", state: (state || "ME").toUpperCase() };
  if (preview.role === "shliach" && !preview.state) return { ok: false, error: "Pick a state." };
  const jar = await cookies();
  jar.set(PREVIEW_COOKIE, encodePreview(preview), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8 });
  redirect("/dashboard");
}

export async function exitPreviewAction(): Promise<ActionResult> {
  const jar = await cookies();
  jar.delete(PREVIEW_COOKIE);
  redirect("/beta");
}
