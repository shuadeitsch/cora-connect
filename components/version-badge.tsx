import { cn } from "@/lib/utils";

export function VersionBadge({ className }: { className?: string }) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "1.1.0";
  const updated = process.env.NEXT_PUBLIC_UPDATED_LABEL || "";
  return (
    <p
      className={cn(
        "max-w-full truncate rounded-full border border-[#d9d0c4] bg-[rgba(255,252,248,0.92)] px-2 py-0.5 text-[10px] leading-4 text-[#12110f]",
        className,
      )}
    >
      v{version}
      {updated ? ` · Updated ${updated}` : ""}
    </p>
  );
}
