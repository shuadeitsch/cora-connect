"use server";

import { geocodeTowns } from "@/lib/geocode";
import { getCurrentUser } from "@/lib/session";

/** Center points for up to 10 cities at a time (keeps each call well under the function time limit). */
export async function cityCentersAction(list: { key: string; city: string; state: string }[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Sign in again." };
  try {
    return { ok: true as const, points: await geocodeTowns(list.slice(0, 10)) };
  } catch {
    return { ok: false as const, error: "Couldn't look up city locations." };
  }
}
