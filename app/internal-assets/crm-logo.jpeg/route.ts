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
  readFileSync(fileURLToPath(new URL("./parts/8", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/9", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/10", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/11", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/12", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/13", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/14", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/15", import.meta.url))),
]);

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
