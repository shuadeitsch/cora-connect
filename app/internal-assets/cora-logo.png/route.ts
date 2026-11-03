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
  readFileSync(fileURLToPath(new URL("./parts/16", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/17", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/18", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/19", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/20", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/21", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/22", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/23", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/24", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/25", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/26", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/27", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/28", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/29", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/30", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/31", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/32", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/33", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/34", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/35", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/36", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/37", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/38", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/39", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/40", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/41", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/42", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/43", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/44", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/45", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/46", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/47", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/48", import.meta.url))),
  readFileSync(fileURLToPath(new URL("./parts/49", import.meta.url))),
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
