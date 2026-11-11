"use client";

import { exportCsvAction } from "@/lib/export-actions";

/** Ask the server for a CSV (bochur is rejected with 403), then save the file. */
export async function downloadCsvFile(input: {
  filename: string;
  headers: string[];
  rows: string[][];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await exportCsvAction(input);
  if (!result.ok) return { ok: false, error: result.error };
  const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename;
  link.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}
