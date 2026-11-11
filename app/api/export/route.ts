import { NextResponse } from "next/server";
import { exportAccess, exportCsvAction } from "@/lib/export-actions";

export const dynamic = "force-dynamic";

/** Bochur (including Beta View as bochur) is rejected with 403. */
export async function GET() {
  const access = await exportAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ error: "Use POST with headers and rows." }, { status: 405 });
}

export async function POST(request: Request) {
  const access = await exportAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  let body: { filename?: string; headers?: string[]; rows?: string[][] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const result = await exportCsvAction({
    filename: body.filename ?? "export.csv",
    headers: body.headers ?? [],
    rows: body.rows ?? [],
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
