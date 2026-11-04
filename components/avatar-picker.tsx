"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { removeAvatarAction, uploadAvatarAction } from "@/lib/avatar-actions";

const SIZE = 512;

/** Crop to a square around the chosen point and shrink to 512×512 JPEG. */
async function cropSquare(file: File, zoom: number, focusX: number, focusY: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height) / zoom;
  const sx = Math.min(Math.max(focusX * bitmap.width - side / 2, 0), bitmap.width - side);
  const sy = Math.min(Math.max(focusY * bitmap.height - side / 2, 0), bitmap.height - side);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("crop"))), "image/jpeg", 0.88));
}

export function AvatarPicker({ name, url }: { name: string; url: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function choose(next: File | undefined) {
    setError("");
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Pick a picture."); return; }
    setFile(next);
    setZoom(1);
    setFocus({ x: 0.5, y: 0.5 });
    setPreview(URL.createObjectURL(next));
  }

  function save() {
    if (!file) return;
    start(async () => {
      try {
        const blob = await cropSquare(file, zoom, focus.x, focus.y);
        const form = new FormData();
        form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
        const result = await uploadAvatarAction(form);
        if (!result.ok) { setError(result.error); return; }
        setFile(null);
        setPreview("");
        router.refresh();
      } catch {
        setError("Couldn't read that picture. Try another one.");
      }
    });
  }

  return (
    <section className="panel mt-4 max-w-2xl rounded-3xl p-4" aria-label="Profile picture">
      <h2 className="font-heading text-lg font-semibold text-foreground">Profile picture</h2>
      {error ? <div className="mt-2"><Notice>{error}</Notice></div> : null}
      {file && preview ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
          <div
            className="relative size-48 cursor-crosshair overflow-hidden rounded-full ring-1 ring-foreground/10"
            title="Tap the face to center it"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setFocus({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="size-full object-cover"
              style={{ transform: `scale(${zoom})`, transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`, objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }}
            />
          </div>
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">It&apos;s cropped to a square. Tap the picture to center it, and zoom in if you like.</p>
            <label className="grid gap-1 text-sm">Zoom
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11 rounded-full px-4" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save picture"}</Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" disabled={pending} onClick={() => { setFile(null); setPreview(""); }}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Avatar name={name} src={url} className="size-16 text-base" />
          <Button type="button" className="min-h-11 rounded-full px-4" onClick={() => input.current?.click()}>{url ? "Change profile picture" : "Add profile picture"}</Button>
          {url ? (
            <Button type="button" variant="outline" className="min-h-11 rounded-full border-red-300 px-4 text-red-700 dark:border-red-800 dark:text-red-300" disabled={pending} onClick={() => start(async () => {
              const result = await removeAvatarAction();
              if (!result.ok) setError(result.error);
              else router.refresh();
            })}>Remove picture</Button>
          ) : null}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" className="sr-only" aria-label="Choose a picture" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ""; }} />
    </section>
  );
}
