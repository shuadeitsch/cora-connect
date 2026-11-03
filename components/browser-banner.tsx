"use client";

import { useEffect, useState } from "react";

const KEY = "cora-browser-banner";

function modernBrowser() {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
  return (
    CSS.supports("color", "color-mix(in srgb, black 40%, transparent)") &&
    CSS.supports("color", "oklch(0.7 0.1 180)")
  );
}

export function BrowserBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(KEY) === "1") return;
    } catch {
      /* private mode */
    }
    if (!modernBrowser()) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[90] flex items-center justify-between gap-3 border-b border-[#e3d9cc] bg-[#fffcf8] px-3 py-2 text-sm text-[#1c1915] shadow-lg"
    >
      <p>Please update your browser.</p>
      <button
        type="button"
        className="shrink-0 rounded-full border border-[#e3d9cc] bg-white px-3 py-1 text-xs font-medium"
        onClick={() => {
          try {
            window.sessionStorage.setItem(KEY, "1");
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
