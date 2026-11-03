export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      version: process.env.NEXT_PUBLIC_APP_VERSION || "",
      build: process.env.NEXT_PUBLIC_BUILD_ID || "",
      updated: process.env.NEXT_PUBLIC_UPDATED_LABEL || "",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
