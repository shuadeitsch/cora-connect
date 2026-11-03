/* The wordmark and O mark are the owner's artwork. next/image is not configured for them. */
/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

const label = "Cora — Chabad Outreach to Rural America";

export function Logo({ full = false, className }: { full?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} role="img" aria-label={label}>
      {full ? (
        <img src="/brand/cora-logo.png" alt="" className="h-12 w-auto max-w-[11.5rem] object-contain object-left" />
      ) : (
        <>
          <img src="/icons/icon-192.png" alt="" className="size-9 rounded-full sm:hidden" />
          <img src="/brand/cora-logo.png" alt="" className="hidden h-9 w-auto max-w-[13rem] object-contain object-left sm:block" />
        </>
      )}
    </span>
  );
}
