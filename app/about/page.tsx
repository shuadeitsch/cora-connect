import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="safe-page min-app-frame mx-auto flex max-w-lg flex-col justify-center px-4 py-16">
      <div className="glass rounded-3xl p-6 sm:p-8">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Cora Connect</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground">Photo credit</h1>
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          The background is the front door of 770 Eastern Parkway in Brooklyn, the Chabad-Lubavitch World Headquarters.
          The photograph was taken by Danny-w and published on Wikimedia Commons under the Creative Commons Attribution-ShareAlike 4.0 license.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This copy is resized to 1920 pixels wide, saved as WebP, and a portrait crop is used on small screens. Those changes stay under CC BY-SA 4.0.
        </p>
        <p className="mt-4 text-sm">
          <a className="text-primary underline" href="https://commons.wikimedia.org/wiki/File:Eastern_Parkway_770_-_front_door.jpg" target="_blank" rel="noreferrer">
            File:Eastern Parkway 770 - front door.jpg
          </a>
        </p>
        <p className="mt-2 text-sm">
          <a className="text-primary underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
            CC BY-SA 4.0
          </a>
        </p>
        <p className="mt-6 text-sm">
          <Link className="text-primary underline" href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
