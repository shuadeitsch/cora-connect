import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const dynamic = "force-static";

const body = Buffer.concat([
  readFileSync(fileURLToPath(new URL("./parts/0", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/1", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/2", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/3", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/4", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/5", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/6", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/7", import.meta.url))),
]);

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
