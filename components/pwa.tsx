"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { hasUnsavedEdits } from "@/lib/app-update";

const IOS_KEY = "outreach-ios-install-hint";
const DISMISS_KEY = "outreach-install-dismissed";

type BeforeInstall = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function iphoneSafari() {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function Pwa() {
  const pathname = usePathname();
  const [install, setInstall] = useState<BeforeInstall | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const inApp = pathname !== "/login" && pathname !== "/signup" && pathname !== "/forgot-password" && pathname !== "/offline" && !pathname.startsWith("/auth");

  useEffect(() => {
    const build = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
    async function registerWorker() {
      if (!("serviceWorker" in navigator)) return;
      const stored = window.localStorage.getItem("cora-sw-build");
      if (stored && stored !== build && !hasUnsavedEdits()) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        window.localStorage.setItem("cora-sw-build", build);
        window.location.reload();
        return;
      }
      window.localStorage.setItem("cora-sw-build", build);
      await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    void registerWorker();
    if (standalone()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    function onPrompt(event: Event) {
      event.preventDefault();
      setInstall(event as BeforeInstall);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    function onInstalled() {
      setInstall(null);
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    window.addEventListener("appinstalled", onInstalled);

    if (iphoneSafari() && window.localStorage.getItem(IOS_KEY) !== "1") {
      window.localStorage.setItem(IOS_KEY, "1");
      setIosHint(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!install && !iosHint) return null;

  return (
    <div
      className={
        inApp
          ? "glass fixed right-3 left-3 z-50 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-foreground bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:right-4 lg:left-auto lg:bottom-4 lg:max-w-sm"
          : "glass fixed right-3 left-3 z-50 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-foreground bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-4 sm:left-auto sm:max-w-sm"
      }
    >
      {install ? (
        <button
          type="button"
          className="min-h-11 flex-1 rounded-full bg-primary px-4 text-left text-sm font-medium text-primary-foreground"
          onClick={() => {
            void install.prompt().then(() => install.userChoice).then((choice) => {
              if (choice.outcome === "accepted") window.localStorage.setItem(DISMISS_KEY, "1");
              setInstall(null);
            }).catch(() => setInstall(null));
          }}
        >
          Install app
        </button>
      ) : (
        <p className="flex-1 py-1">Tap Share → Add to Home Screen</p>
      )}
      <button
        type="button"
        aria-label="Dismiss install hint"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, "1");
          window.localStorage.setItem(IOS_KEY, "1");
          setInstall(null);
          setIosHint(false);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
