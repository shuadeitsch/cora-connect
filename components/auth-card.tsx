import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="safe-page min-app-frame relative flex items-center justify-center px-4 py-12">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="page-enter glass w-full max-w-md rounded-3xl p-6 sm:p-8">
        {/* Cora Connect logo with its background removed. next/image is not configured for brand art. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/cora-connect-logo.png"
          alt="Cora Connect"
          width={873}
          height={365}
          className="mx-auto block h-auto w-64 max-w-[80%] dark:rounded-2xl dark:bg-white/90 dark:p-2"
        />
        <h1 className="mt-6 font-heading text-3xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function AuthErrorText(code: string, known: Record<string, string>) {
  if (!code) return "";
  return known[code] ?? decodeURIComponent(code);
}
