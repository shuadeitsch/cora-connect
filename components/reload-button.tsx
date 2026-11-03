"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  clearUnsaved,
  hasUnsavedEdits,
  isRemoteUpdate,
  markUnsaved,
  refreshInstalledApp,
  shouldTrackField,
  UNSAVED_RELOAD_WARNING,
} from "@/lib/app-update";
import { cn } from "@/lib/utils";

const LOCAL_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

export function ReloadButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    clearUnsaved();
  }, [pathname]);

  useEffect(() => {
    function onEdit(event: Event) {
      if (!event.isTrusted) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-reload-ignore]")) return;
      const field = target.closest("input, textarea, select");
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      const type = field instanceof HTMLInputElement ? field.type : "";
      if (!shouldTrackField(field.tagName, type, Boolean(field.closest("form")))) return;
      markUnsaved();
    }
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => {
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    async function look() {
      try {
        const response = await fetch("/api/version", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const body = (await response.json()) as { build?: string };
        if (!cancel && isRemoteUpdate(LOCAL_BUILD, body.build)) setUpdateAvailable(true);
      } catch {
        /* offline: the button still reloads */
      }
      if (!("serviceWorker" in navigator) || cancel) return;
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration || cancel) return;
      await registration.update().catch(() => undefined);
      if (registration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true);
    }
    void look();
    const timer = window.setInterval(() => void look(), 60_000);
    function onVisible() {
      if (document.visibilityState === "visible") void look();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancel = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let hadController = Boolean(navigator.serviceWorker.controller);
    function onControllerChange() {
      if (hadController) setUpdateAvailable(true);
      hadController = true;
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  async function reload() {
    if (pending) return;
    if (hasUnsavedEdits() && !window.confirm(UNSAVED_RELOAD_WARNING)) return;
    setPending(true);
    try {
      await refreshInstalledApp();
    } catch {
      window.location.reload();
    }
  }

  const label = pending ? "Reloading…" : updateAvailable ? "Update available" : "Reload";

  return (
    <button
      type="button"
      data-reload-button
      aria-live="polite"
      aria-busy={pending}
      disabled={pending}
      title={updateAvailable ? "A newer version is deployed. Reload to open it." : "Check for a new version and reload"}
      onClick={() => void reload()}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
        updateAvailable
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-[#d9d0c4] bg-[rgba(255,252,248,0.92)] text-[#12110f]",
        className,
      )}
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
      {label}
    </button>
  );
}
