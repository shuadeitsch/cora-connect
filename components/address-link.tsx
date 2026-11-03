"use client";

import { useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mapLinks } from "@/lib/format";
import { cn } from "@/lib/utils";

const APPS = [
  { key: "google", label: "Google Maps" },
  { key: "apple", label: "Apple Maps" },
  { key: "waze", label: "Waze" },
] as const;

// Tapping an address opens a small chooser for Google Maps, Apple Maps, or Waze.
export function AddressLink({
  address,
  lat = null,
  lng = null,
  children,
  className,
  label,
}: {
  address: string;
  lat?: number | null;
  lng?: number | null;
  children?: ReactNode;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const text = address.trim();
  if (!text && (lat == null || lng == null)) return <>{children}</>;
  const links = mapLinks(lat, lng, text);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? `Open ${text || "address"} in maps`}
          className={cn("cursor-pointer text-left underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none", className)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {children ?? text}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-1 p-1.5" onClick={(event) => event.stopPropagation()}>
        {APPS.map((app) => (
          <a
            key={app.key}
            href={links[app.key]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            onClick={() => setOpen(false)}
          >
            <MapPin className="size-4 text-primary" /> {app.label}
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}
