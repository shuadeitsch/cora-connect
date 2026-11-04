import { cn } from "@/lib/utils";

export function Avatar({ name, className, src }: { name: string; className?: string; src?: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
  if (src) {
    return (
      // Supabase Storage URL; next/image is not configured for it.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" aria-hidden className={cn("inline-block size-10 shrink-0 rounded-full object-cover", className)} />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
