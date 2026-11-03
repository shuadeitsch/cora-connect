import { readFileSync } from "node:fs";
import { join } from "node:path";

export function GET() {
  const id = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
  const source = readFileSync(join(process.cwd(), "service-worker/sw.js"), "utf8").replaceAll("__BUILD_ID__", id);
  return new Response(source, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
