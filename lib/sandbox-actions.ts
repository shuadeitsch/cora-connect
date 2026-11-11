"use server";

import { cookies } from "next/headers";
import { SANDBOX_COOKIE } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

/** Turn on the Tutorial practice sandbox. Any signed-in role. Does not write user data. */
export async function startTutorialSandboxAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again." };
  const jar = await cookies();
  jar.set(SANDBOX_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8 });
  return { ok: true };
}

export async function exitTutorialSandboxAction(): Promise<ActionResult> {
  const jar = await cookies();
  jar.delete(SANDBOX_COOKIE);
  return { ok: true };
}
