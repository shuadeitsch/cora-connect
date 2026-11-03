import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

function appVersion() {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version?: string };
  return pkg.version || "1.1.0";
}

function updatedLabel() {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  return `${formatted} ET`;
}

function buildId() {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.slice(0, 12);
  if (process.env.NODE_ENV !== "production") return "dev";
  try {
    return execSync("git rev-parse --short=12 HEAD", { encoding: "utf8" }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId(),
    NEXT_PUBLIC_APP_VERSION: appVersion(),
    NEXT_PUBLIC_UPDATED_LABEL: updatedLabel(),
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/brand/cora-logo.png", destination: "/internal-assets/cora-logo.png" },
        { source: "/770-bg.jpg", destination: "/internal-assets/770-bg.jpg" },
        { source: "/770-bg.webp", destination: "/internal-assets/770-bg.webp" },
        { source: "/icons/icon-192.png", destination: "/internal-assets/icon-192.png" },
        { source: "/icons/icon-512.png", destination: "/internal-assets/icon-512.png" },
        { source: "/icon-192.png", destination: "/internal-assets/icon-192.png" },
        { source: "/icon-512.png", destination: "/internal-assets/icon-512.png" },
        { source: "/brand/crm-logo.jpeg", destination: "/internal-assets/crm-logo.jpeg" },
      ],
    };
  },
  outputFileTracingIncludes: {
    "/internal-assets/cora-logo.png": ["./app/internal-assets/cora-logo.png/parts/**"],
    "/internal-assets/770-bg.jpg": ["./app/internal-assets/770-bg.jpg/parts/**"],
    "/internal-assets/770-bg.webp": ["./app/internal-assets/770-bg.webp/parts/**"],
    "/internal-assets/icon-192.png": ["./app/internal-assets/icon-192.png/parts/**"],
    "/internal-assets/icon-512.png": ["./app/internal-assets/icon-512.png/parts/**"],
    "/internal-assets/crm-logo.jpeg": ["./app/internal-assets/crm-logo.jpeg/parts/**"],
  },
};

export default nextConfig;
