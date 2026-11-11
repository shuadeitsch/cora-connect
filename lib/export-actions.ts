"use server";

import { toCsv } from "@/lib/csv";
import { canExportRole } from "@/lib/export-access";
import { readPreview } from "@/lib/preview";
import { getCurrentUser } from "@/lib/session";

export type ExportDenied = { ok: false; error: string; status: 403 };
export type ExportAllowed = { ok: true; csv: string; filename: string };

function denied(message = "You don't have permission to download a CSV."): ExportDenied {
  return { ok: false, error: message, status: 403 };
}

/** Who may export: real admin/shliach, not a bochur, and not Beta View as bochur. */
export async function exportAccess(): Promise<{ ok: true } | ExportDenied> {
  const user = await getCurrentUser();
  if (!user) return denied("Sign in again.");
  const preview = await readPreview();
  const role = preview?.role === "bochur" ? "bochur" : user.role;
  if (!canExportRole(role)) return denied();
  return { ok: true };
}

/** Build a CSV for an allowed exporter. Bochur users (including Beta View as bochur) get 403. */
export async function exportCsvAction(input: {
  filename: string;
  headers: string[];
  rows: string[][];
}): Promise<ExportAllowed | ExportDenied> {
  const access = await exportAccess();
  if (!access.ok) return access;
  const filename = (input.filename || "export.csv").replace(/[^\w.\-]+/g, "-");
  return { ok: true, csv: toCsv(input.headers, input.rows), filename };
}
