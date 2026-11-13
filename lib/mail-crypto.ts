import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "crypto";

const PREFIX = "v1";

function keyMaterial(): Buffer {
  const raw = process.env.MAIL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("MAIL_TOKEN_ENCRYPTION_KEY is not set.");
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const asBuf = Buffer.from(raw, "base64");
  if (asBuf.length === 32) return asBuf;
  return scryptSync(raw, "cora-mail-token-v1", 32);
}

export function encryptSecret(plain: string): { cipher: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: `${PREFIX}.${Buffer.concat([enc, tag]).toString("base64url")}`,
    iv: iv.toString("base64url"),
  };
}

export function decryptSecret(cipher: string, iv: string): string {
  const raw = cipher.startsWith(`${PREFIX}.`) ? cipher.slice(PREFIX.length + 1) : cipher;
  const buf = Buffer.from(raw, "base64url");
  if (buf.length < 17) throw new Error("Stored token is not valid.");
  const data = buf.subarray(0, buf.length - 16);
  const tag = buf.subarray(buf.length - 16);
  const dec = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(iv, "base64url"));
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(data), dec.final()]).toString("utf8");
}

export function signUnsubscribeToken(payload: { personId: string; email: string }): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", keyMaterial()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyUnsubscribeToken(token: string): { personId: string; email: string } | null {
  const cut = token.trim().lastIndexOf(".");
  if (cut <= 0) return null;
  const body = token.trim().slice(0, cut);
  const mac = token.trim().slice(cut + 1);
  const expected = createHmac("sha256", keyMaterial()).update(body).digest("base64url");
  if (mac.length !== expected.length) return null;
  // timing-safe compare
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  if (diff !== 0) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { personId?: unknown; email?: unknown };
    if (typeof parsed.personId !== "string" || typeof parsed.email !== "string") return null;
    return { personId: parsed.personId, email: parsed.email };
  } catch {
    return null;
  }
}
