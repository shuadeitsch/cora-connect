"use client";

import { Check, ImagePlus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { removeBackgroundAction, uploadBackgroundAction } from "@/lib/background-actions";
import { saveThemeAction } from "@/lib/theme-actions";
import { applyTheme, isThemeId, THEME_KEY, THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

const MAX_EDGE = 1920;

/** Resize to fit within 1920px on the long edge and compress as JPEG. */
async function resizeCover(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", 0.82),
  );
}

export function ThemePicker({ saved, backgroundUrl }: { saved: string | null; backgroundUrl: string | null }) {
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<ThemeId>(isThemeId(saved) ? saved : "classic");
  const [bgUrl, setBgUrl] = useState(backgroundUrl);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  useEffect(() => {
    const local = window.localStorage.getItem(THEME_KEY);
    if (isThemeId(local)) setCurrent(local);
    else if (document.documentElement.classList.contains("dark")) setCurrent("dark");
  }, []);
  useEffect(() => {
    setBgUrl(backgroundUrl);
  }, [backgroundUrl]);

  async function pick(id: ThemeId) {
    applyTheme(id);
    setCurrent(id);
    const result = await saveThemeAction(id).catch(() => ({ ok: false as const, error: "Couldn't save your theme. It still applies on this device." }));
    if (!result.ok) toast({ title: result.error, tone: "error" });
  }

  function choose(next: File | undefined) {
    setError("");
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setError("Pick a picture.");
      return;
    }
    start(async () => {
      try {
        const blob = await resizeCover(next);
        const form = new FormData();
        form.append("file", new File([blob], "background.jpg", { type: "image/jpeg" }));
        const result = await uploadBackgroundAction(form);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setBgUrl(result.url);
        router.refresh();
      } catch {
        setError("Couldn't read that picture. Try another one.");
      }
    });
  }

  return (
    <section className="panel mt-4 max-w-2xl rounded-3xl p-4" aria-label="Theme">
      <h2 className="font-heading text-lg font-semibold text-foreground">Theme</h2>
      <p className="text-sm text-muted-foreground">Pick the colors you like. It&apos;s saved to your account.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            aria-pressed={current === theme.id}
            onClick={() => pick(theme.id)}
            className={cn(
              "relative overflow-hidden rounded-2xl text-left ring-1 ring-border transition hover:ring-2 hover:ring-primary/50",
              current === theme.id && "ring-2 ring-primary",
            )}
          >
            <div className="flex h-16 items-end gap-1.5 p-2" style={{ background: theme.swatch[1] }}>
              <span className="h-full flex-1 rounded-lg" style={{ background: theme.swatch[2], boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }}>
                <span className="m-1.5 block h-2 w-2/3 rounded-full" style={{ background: theme.swatch[0] }} />
              </span>
              <span className="size-7 rounded-full" style={{ background: theme.swatch[0] }} />
            </div>
            <div className="flex items-center justify-between bg-card px-2.5 py-2 text-sm font-medium text-foreground">
              {theme.label}
              {current === theme.id ? <Check className="size-4 text-primary" /> : null}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Background photo</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your own full-page background. A light overlay keeps text readable. Works on phones and Chromebooks.
        </p>
        {error ? (
          <div className="mt-2">
            <Notice>{error}</Notice>
          </div>
        ) : null}
        {bgUrl ? (
          <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgUrl} alt="Your background" className="h-28 w-full object-cover sm:h-36" />
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" className="min-h-11 rounded-full px-4" disabled={pending} onClick={() => input.current?.click()}>
            <ImagePlus className="mr-1.5 size-4" />
            {pending ? "Uploading…" : bgUrl ? "Change background photo" : "Upload your own background photo"}
          </Button>
          {bgUrl ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full border-red-300 px-4 text-red-700 dark:border-red-800 dark:text-red-300"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError("");
                  const result = await removeBackgroundAction();
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setBgUrl(null);
                  router.refresh();
                })
              }
            >
              Remove photo
            </Button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Upload your own background photo"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
