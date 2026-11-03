"use client";

import { useState } from "react";
import { resetApp } from "@/lib/reset-app";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || "Try the page again."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="h-10 rounded-full border px-4 text-sm" onClick={reset}>
          Try again
        </button>
        <button
          type="button"
          className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void resetApp();
          }}
        >
          {pending ? "Resetting…" : "Reset app"}
        </button>
      </div>
    </div>
  );
}
