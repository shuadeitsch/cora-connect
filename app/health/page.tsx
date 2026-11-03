import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Health" };

export default function HealthPage() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "1.1.0";
  const updated = process.env.NEXT_PUBLIC_UPDATED_LABEL || "";
  const build = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
  return (
    <main style={{ margin: 0, minHeight: "100vh", background: "#f3efe8", color: "#12110f", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Cora Connect</h1>
      <p>v{version}{updated ? ` · Updated ${updated}` : ""}</p>
      <p>Build {build}</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/debug">Debug</Link>
        {" · "}
        <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
