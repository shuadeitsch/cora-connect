"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DebugPage() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "1.1.0";
  const updated = process.env.NEXT_PUBLIC_UPDATED_LABEL || "";
  const build = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
  const [facts, setFacts] = useState("Reading this browser…");

  useEffect(() => {
    let cancel = false;
    async function read() {
      const registrations = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
      const controller = "serviceWorker" in navigator ? navigator.serviceWorker.controller?.scriptURL ?? "none" : "unsupported";
      const lines = [
        `Version v${version}${updated ? ` · Updated ${updated}` : ""}`,
        `Build ${build}`,
        `Stored build ${window.localStorage.getItem("cora-sw-build") ?? "none"}`,
        `Service workers ${registrations.map((item) => item.scope).join(", ") || "none"}`,
        `Controller ${controller}`,
        `Viewport ${window.innerWidth}×${window.innerHeight}`,
        `Cookies ${navigator.cookieEnabled ? "enabled" : "blocked"}`,
        `Time ${new Date().toISOString()}`,
        navigator.userAgent,
      ];
      if (!cancel) setFacts(lines.join("\n"));
    }
    void read();
    return () => {
      cancel = true;
    };
  }, [build, updated, version]);

  return (
    <main style={{ margin: 0, minHeight: "100vh", background: "#f3efe8", color: "#12110f", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Debug</h1>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{facts}</pre>
      <p style={{ marginTop: 16 }}>
        <Link href="/health">Health</Link>
        {" · "}
        <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
