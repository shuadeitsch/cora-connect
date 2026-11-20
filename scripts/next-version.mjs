// Prints the next release version. Patch stops at 99 (X.Y.99 -> X.(Y+1).0) and minor stops at 9 (X.9.99 -> (X+1).0.0).
// Usage: node scripts/next-version.mjs [current]   (defaults to package.json's version)
import { readFileSync } from "node:fs";

export function nextVersion(current) {
  let [major, minor, patch] = current.split(".").map(Number);
  patch += 1;
  if (patch > 99) { patch = 0; minor += 1; }
  if (minor > 9) { minor = 0; major += 1; }
  return `${major}.${minor}.${patch}`;
}

const current = process.argv[2] ?? JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
console.log(nextVersion(current));
