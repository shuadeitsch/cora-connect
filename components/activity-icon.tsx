"use client";

import { Flame, MessageCircle, PenLine, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeActivity } from "@/lib/constants";

/** Small tefillin box with straps — emoji-sized inline SVG (no standard emoji). */
export function TefillinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      className={cn("inline-block shrink-0 align-[-0.125em]", className)}
      aria-hidden
      focusable="false"
    >
      {/* straps */}
      <path
        d="M3.2 7.2c0 0-.6 2.8-.2 4.6M12.8 7.2c0 0 .6 2.8.2 4.6M4.2 11.5c1.2.6 2.4.9 3.8.9s2.6-.3 3.8-.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      {/* box */}
      <rect x="4.2" y="2.2" width="7.6" height="5.4" rx="0.9" fill="currentColor" opacity="0.92" />
      {/* shin-ish mark */}
      <path
        d="M6.2 4.1h1.15M7.35 3.5v2.2M8.65 3.5v2.2M8.65 4.1h1.2"
        fill="none"
        stroke="var(--background, #fff)"
        strokeWidth="0.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Glyph({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)} aria-hidden>
      {children}
    </span>
  );
}

/** Glyph for a visit activity label (emoji or SVG), sized like a lucide icon. */
export function ActivityIcon({ label, className }: { label: string; className?: string }) {
  const size = cn("size-3.5 shrink-0 text-[0.95rem] leading-none", className);
  const official = normalizeActivity(label) || label;
  if (official === "Nice conversation") return <MessageCircle className={size} aria-hidden />;
  if (official === "Tefillin") return <TefillinIcon className={size} />;
  if (official === "Shabbos candles") return <Flame className={size} aria-hidden />;
  if (official === "Menorah") return <Glyph className={size}>🕎</Glyph>;
  if (official === "Package" || label === "Menorah/package") return <Glyph className={size}>📦</Glyph>;
  if (official === "Challah") return <Glyph className={size}>🍞</Glyph>;
  if (official === "Mezuzah") return <ScrollText className={size} aria-hidden />;
  if (label === "Write-in" || official === "Other") return <PenLine className={size} aria-hidden />;
  return null;
}
