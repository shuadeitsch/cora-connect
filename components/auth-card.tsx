import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReloadButton } from "@/components/reload-button";
import { VersionBadge } from "@/components/version-badge";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="safe-page min-app-frame relative flex items-center justify-center px-4 py-12">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="page-enter glass w-full max-w-md rounded-3xl p-6 sm:p-8">
        <Logo full />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <VersionBadge />
          <ReloadButton />
        </div>
        <h1 className="mt-6 font-heading text-3xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          Background photo of 770 Eastern Parkway by{" "}
          <a className="underline" href="https://commons.wikimedia.org/wiki/File:Eastern_Parkway_770_-_front_door.jpg" target="_blank" rel="noreferrer">Danny-w</a>
          , <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.{" "}
          <Link className="underline" href="/about">Credit</Link>
        </p>
      </div>
    </div>
  );
}

export function AuthErrorText(code: string, known: Record<string, string>) {
  if (!code) return "";
  return known[code] ?? decodeURIComponent(code);
}
