"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Phone bottom sheet: closes with the X, a tap outside, or a swipe down on its top bar. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const start = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  function end() {
    if (drag > 70) onOpenChange(false);
    start.current = null;
    setDrag(0);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "max-h-[88dvh] gap-0 rounded-t-3xl p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          className,
        )}
        style={
          drag
            ? { transform: `translateY(${drag}px)`, transition: "none" }
            : undefined
        }
      >
        <div
          data-sheet-grip
          className="shrink-0 touch-none select-none px-4 pt-2 pb-2"
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            start.current = event.clientY;
            (event.currentTarget as HTMLElement).setPointerCapture(
              event.pointerId,
            );
          }}
          onPointerMove={(event) => {
            if (start.current == null) return;
            setDrag(Math.max(0, event.clientY - start.current));
          }}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div
            className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-muted-foreground/30"
            aria-hidden
          />
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="font-heading text-base font-semibold text-foreground">
              {title}
            </SheetTitle>
            <button
              type="button"
              aria-label="Close"
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-muted"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5" />
            </button>
          </div>
          <SheetDescription
            className={
              description ? "text-xs text-muted-foreground" : "sr-only"
            }
          >
            {description || title}
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
