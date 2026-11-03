import { createHash } from "crypto";

export function hashPassword(password: string): string {
  return createHash("sha256").update(`cora-demo-v1:${password}`).digest("hex");
}
