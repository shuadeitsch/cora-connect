"use client";

import { useState } from "react";
import { resetApp } from "@/lib/reset-app";

export default function GlobalError({ error }: { error: Error }) {
  const [pending, setPending] = useState(false);
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f3efe8", color: "#12110f", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>{error.message || "The page could not finish loading."}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void resetApp();
            }}
            style={{ marginTop: 16, height: 40, border: 0, borderRadius: 999, padding: "0 16px", background: "#0f766e", color: "#fff" }}
          >
            {pending ? "Resetting…" : "Reset app"}
          </button>
        </main>
      </body>
    </html>
  );
}
