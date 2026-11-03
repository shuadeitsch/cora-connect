"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Toast = {
  id: number;
  title: string;
  tone?: "ok" | "error";
  undo?: () => void | Promise<void>;
};

type ToastInput = Omit<Toast, "id">;

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function typingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    window.setTimeout(() => dismiss(id), toast.undo ? 10000 : 3200);
  }, [dismiss]);

  const runUndo = useCallback((toast: Toast) => {
    dismiss(toast.id);
    if (toast.undo) void toast.undo();
  }, [dismiss]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey || event.altKey) return;
      if (typingTarget(event.target)) return;
      const latest = [...toasts].reverse().find((toast) => toast.undo);
      if (!latest) return;
      event.preventDefault();
      runUndo(latest);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runUndo, toasts]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-[80] flex w-[min(100%-1.5rem,24rem)] -translate-x-1/2 flex-col gap-2 lg:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-border bg-popover px-4 py-3 text-sm text-foreground shadow-lg",
              toast.tone === "error" && "text-destructive",
            )}
          >
            <span>{toast.title}</span>
            {toast.undo ? (
              <button type="button" className="font-semibold text-primary" onClick={() => runUndo(toast)}>
                Undo
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
