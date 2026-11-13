"use client";

import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 450;
const MOVE_PX = 8;

export function SortableNav<T extends { href: string }>({
  items,
  onReorder,
  className,
  render,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  className?: string;
  render: (item: T, handle: { listeners: ButtonHTMLAttributes<HTMLButtonElement> }) => ReactNode;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const listRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: string; y: number; moved: boolean; timer: number | null } | null>(null);

  function indexFromY(clientY: number): number {
    const root = listRef.current;
    if (!root) return 0;
    const rows = [...root.querySelectorAll<HTMLElement>("[data-nav-id]")];
    if (!rows.length) return 0;
    for (let i = 0; i < rows.length; i += 1) {
      const box = rows[i]!.getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return i;
    }
    return rows.length - 1;
  }

  function moveTo(id: string, clientY: number) {
    const current = itemsRef.current;
    const from = current.findIndex((item) => item.href === id);
    const to = indexFromY(clientY);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...current];
    const [row] = next.splice(from, 1);
    if (!row) return;
    next.splice(to, 0, row);
    onReorder(next);
  }

  function finish() {
    const rec = start.current;
    if (rec?.timer) window.clearTimeout(rec.timer);
    start.current = null;
    setDragging(null);
  }

  function begin(id: string, clientY: number, pointerId: number, target: HTMLElement, immediate: boolean) {
    const rec = { id, y: clientY, moved: false, timer: null as number | null };
    start.current = rec;
    const arm = () => {
      if (!start.current || start.current.id !== id) return;
      setDragging(id);
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* capture is best-effort */
      }
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(12);
      }
    };
    if (immediate) arm();
    else rec.timer = window.setTimeout(arm, LONG_PRESS_MS);
  }

  return (
    <div
      ref={listRef}
      className={className}
      onPointerMove={(event) => {
        const rec = start.current;
        if (!rec) return;
        const dy = Math.abs(event.clientY - rec.y);
        if (!dragging && dy > MOVE_PX && rec.timer) {
          // moved before long-press: cancel, this is a scroll
          window.clearTimeout(rec.timer);
          rec.timer = null;
          if (event.pointerType !== "mouse") {
            start.current = null;
            return;
          }
        }
        if (!dragging && event.pointerType === "mouse" && dy > MOVE_PX) {
          setDragging(rec.id);
          rec.moved = true;
        }
        if (!dragging && rec.timer) return;
        if (rec.id && (dragging || rec.moved)) {
          rec.moved = true;
          event.preventDefault();
          moveTo(rec.id, event.clientY);
        }
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {items.map((item) => (
        <div
          key={item.href}
          data-nav-id={item.href}
          className={cn("relative", dragging === item.href && "opacity-70")}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            if ((event.target as HTMLElement).closest("[data-nav-handle]")) {
              event.preventDefault();
              begin(item.href, event.clientY, event.pointerId, event.currentTarget, true);
              return;
            }
            if (event.pointerType !== "mouse") {
              begin(item.href, event.clientY, event.pointerId, event.currentTarget, false);
            }
          }}
          onClickCapture={(event) => {
            if (start.current?.moved || dragging === item.href) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {render(item, {
            listeners: {
              "data-nav-handle": "",
              type: "button",
              "aria-label": "Drag to reorder",
              className:
                "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground touch-none",
            } as ButtonHTMLAttributes<HTMLButtonElement>,
          })}
        </div>
      ))}
    </div>
  );
}

export function NavHandle({ listeners }: { listeners: ButtonHTMLAttributes<HTMLButtonElement> }) {
  return (
    <button {...listeners} data-nav-handle="" type="button" aria-label={listeners["aria-label"] as string ?? "Drag to reorder"}>
      <GripVertical className="size-4" />
    </button>
  );
}
