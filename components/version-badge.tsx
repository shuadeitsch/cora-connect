import { cn } from "@/lib/utils";

/** Compact admin-only build pill — hugs the text, never full width. */
export function VersionBadge({ className }: { className?: string }) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "1.1.0";
  const updated = process.env.NEXT_PUBLIC_UPDATED_LABEL || "";
  // Prefer a short date on one mobile line: "Nov 9, 6:20 PM" (drop year / ET if present).
  const short = updated
    .replace(/\b\d{4},?\s*/g, "")
    .replace(/\s*ET\s*$/i, "")
    .replace(/,\s*,/g, ",")
    .trim();
  const label = short ? `v${version} · ${short}` : `v${version}`;
  return (
    <p
      title={updated ? `v${version} · ${updated}` : `v${version}`}
      className={cn(
        "inline-flex w-fit max-w-full shrink-0 items-center whitespace-nowrap rounded-full border border-[#d9d0c4] bg-white px-2 py-0.5 text-[10px] leading-4 text-[#12110f]",
        className,
      )}
    >
      {label}
    </p>
  );
}
