import "server-only";
import { headers } from "next/headers";

export async function requestOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host"))?.split(",")[0]?.trim();
  const proto = (headerList.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:43123";
}

export function googleAuthEnabled() {
  return process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";
}
