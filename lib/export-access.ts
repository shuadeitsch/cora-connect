import type { Role } from "@/lib/types";

/** CSV export is for admins and shluchim only — never a bochur, including Beta View as bochur. */
export function canExportRole(role: Role | string | null | undefined): boolean {
  return role === "admin" || role === "shliach";
}
