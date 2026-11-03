"use client";

import { useState } from "react";
import { resetApp } from "@/lib/reset-app";

export default function RootError({ error }: { error: Error }) {
  const [pending, setPending] = useState(false);
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || "The page could not finish loading."}</p>
      <button
        type="button"
        className="mt-4 h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void resetApp();
        }}
      >
        {pending ? "Resetting…" : "Reset app"}
      </button>
    </div>
  );
}
