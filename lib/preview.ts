import "server-only";
import { cookies } from "next/headers";
import { FOCUS_STATES } from "@/lib/constants";
import type { Role, User } from "@/lib/types";

export const PREVIEW_COOKIE = "cora_preview";

export type PreviewMode = {
  role: "shliach" | "bochur";
  /** State code for shliach/bochur preview territory, e.g. ME. */
  state?: string;
};

const STATE_CODES = new Set<string>(
  FOCUS_STATES.filter((item) => item.code !== "Unsorted").map((item) => item.code),
);

export function parsePreview(raw: string | undefined | null): PreviewMode | null {
  if (!raw) return null;
  const [role, state] = raw.split(":");
  if (role === "bochur" && state && STATE_CODES.has(state.toUpperCase())) {
    return { role: "bochur", state: state.toUpperCase() };
  }
  if (role === "bochur") return { role: "bochur", state: "ME" };
  if (role === "shliach" && state && STATE_CODES.has(state.toUpperCase())) {
    return { role: "shliach", state: state.toUpperCase() };
  }
  return null;
}

export function encodePreview(preview: PreviewMode): string {
  return `${preview.role}:${preview.state ?? "ME"}`;
}

export async function readPreview(): Promise<PreviewMode | null> {
  const jar = await cookies();
  return parsePreview(jar.get(PREVIEW_COOKIE)?.value);
}

/** Admins only. Turns the real admin user into a role-shaped viewer for present(). */
export function applyPreview(user: User, preview: PreviewMode | null): User {
  if (!preview || user.role !== "admin") return user;
  if (preview.role === "bochur") {
    return {
      ...user,
      role: "bochur" as Role,
      canEdit: false,
      canViewHistory: true,
      canViewContact: true,
      leaderId: user.id,
      territory: [{ state: preview.state ?? "ME", area: "" }],
      previewing: true,
    };
  }
  return {
    ...user,
    role: "shliach" as Role,
    canEdit: true,
    canViewHistory: true,
    canViewContact: true,
    leaderId: null,
    territory: [{ state: preview.state ?? "ME", area: "" }],
    previewing: true,
  };
}

export async function assertNotPreview(): Promise<{ ok: true } | { ok: false; error: string }> {
  const preview = await readPreview();
  if (preview) return { ok: false, error: "Preview only" };
  return { ok: true };
}
