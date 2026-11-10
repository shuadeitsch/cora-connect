"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  loadLocalTutorial,
  saveLocalTutorial,
  tutorialRoleFrom,
  tutorialStepsFor,
  type TutorialProgress,
  type TutorialRole,
  type TutorialStep,
} from "@/lib/tutorial";
import { saveTutorialProgressAction } from "@/lib/tutorial-actions";
import type { Viewer } from "@/lib/types";
import { cn } from "@/lib/utils";

type TutorialContextValue = {
  role: TutorialRole;
  steps: TutorialStep[];
  progress: TutorialProgress;
  active: boolean;
  start: () => void;
  resume: () => void;
  restart: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used inside TutorialProvider");
  return ctx;
}

export function useTutorialOptional() {
  return useContext(TutorialContext);
}

function clampStep(step: number, length: number) {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, step), length - 1);
}

function hrefMatches(href: string, pathname: string, search: string) {
  const [path, query = ""] = href.split("?");
  if (pathname !== path) return false;
  if (!query) return true;
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of want.entries()) {
    if (have.get(key) !== value) return false;
  }
  return true;
}

function measure(target?: string): DOMRect | null {
  if (!target || typeof document === "undefined") return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 && rect.height < 2) return null;
  return rect;
}

export function TutorialProvider({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const role = tutorialRoleFrom(viewer.role);
  const steps = useMemo(() => tutorialStepsFor(role), [role]);
  const preview = Boolean(viewer.preview);
  const [progress, setProgress] = useState<TutorialProgress>(() => ({
    step: viewer.tutorialStep ?? 0,
    done: Boolean(viewer.tutorialDone),
  }));
  const [active, setActive] = useState(false);

  useEffect(() => {
    const local = loadLocalTutorial(viewer.id, role);
    setProgress((prev) => {
      if (preview) return local ?? { step: 0, done: false };
      if (local && !preview) {
        if (local.done && !prev.done) return local;
        if (!local.done && (prev.done || local.step > prev.step)) return local;
      }
      return { step: viewer.tutorialStep ?? 0, done: Boolean(viewer.tutorialDone) };
    });
  }, [preview, role, viewer.id, viewer.tutorialDone, viewer.tutorialStep]);

  const persist = useCallback(
    (next: TutorialProgress) => {
      setProgress(next);
      saveLocalTutorial(viewer.id, role, next);
      if (!preview) {
        void saveTutorialProgressAction({ step: next.step, done: next.done });
      }
    },
    [preview, role, viewer.id],
  );

  const startAt = useCallback(
    (index: number) => {
      const step = clampStep(index, steps.length);
      persist({ step, done: false });
      setActive(true);
    },
    [persist, steps.length],
  );

  const value = useMemo<TutorialContextValue>(
    () => ({
      role,
      steps,
      progress,
      active,
      start: () => startAt(0),
      resume: () => startAt(progress.done ? 0 : progress.step),
      restart: () => startAt(0),
    }),
    [active, progress, role, startAt, steps],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {active ? (
        <Suspense fallback={null}>
          <TutorialOverlay
            steps={steps}
            index={clampStep(progress.step, steps.length)}
            onIndex={(step) => persist({ step, done: false })}
            onFinish={() => {
              persist({ step: Math.max(0, steps.length - 1), done: true });
              setActive(false);
            }}
            onExit={() => {
              persist({ step: clampStep(progress.step, steps.length), done: false });
              setActive(false);
            }}
          />
        </Suspense>
      ) : null}
    </TutorialContext.Provider>
  );
}

function TutorialOverlay({
  steps,
  index,
  onIndex,
  onFinish,
  onExit,
}: {
  steps: TutorialStep[];
  index: number;
  onIndex: (step: number) => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const step = steps[index];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  const go = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0) return;
      if (nextIndex >= steps.length) {
        onFinish();
        router.push("/tutorials");
        return;
      }
      onIndex(nextIndex);
    },
    [onFinish, onIndex, steps.length],
  );

  useEffect(() => {
    if (!step) return;
    if (!hrefMatches(step.href, pathname, search)) {
      setReady(false);
      setRect(null);
      router.push(step.href);
    }
  }, [pathname, router, search, step]);

  useEffect(() => {
    if (!step) return;
    if (!hrefMatches(step.href, pathname, search)) return;
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      const found = measure(step.target);
      if (found) {
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        }
        window.setTimeout(() => {
          if (!cancelled) {
            setRect(measure(step.target));
            setReady(true);
          }
        }, 220);
        return;
      }
      tries += 1;
      if (tries < 12) {
        window.setTimeout(tick, 80);
        return;
      }
      setRect(null);
      setReady(true);
    };
    const start = window.setTimeout(tick, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [pathname, search, step]);

  useEffect(() => {
    if (!ready || !rect || !step?.target) return;
    const update = () => setRect(measure(step.target));
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [ready, rect, step]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  if (!step) return null;
  const total = steps.length;
  const pad = 8;
  const hole = rect
    ? {
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: Math.min(rect.width + pad * 2, window.innerWidth - 16),
        height: Math.min(rect.height + pad * 2, window.innerHeight - 16),
      }
    : null;
  const cardWidth = 340;
  const viewportW = typeof window === "undefined" ? 400 : window.innerWidth;
  const viewportH = typeof window === "undefined" ? 700 : window.innerHeight;
  let cardTop = Math.max(12, (viewportH - 240) / 2);
  let cardLeft = Math.max(12, (viewportW - cardWidth) / 2);
  if (hole) {
    const below = hole.top + hole.height + 12;
    const above = hole.top - 12;
    const preferBelow = below + 260 < viewportH || hole.top < 140;
    cardTop = preferBelow ? Math.min(below, viewportH - 220) : Math.max(12, above - 220);
    cardLeft = Math.min(Math.max(12, hole.left), viewportW - cardWidth - 12);
  }

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="absolute inset-0 bg-foreground/50" onClick={onExit} />
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white/90"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(15, 18, 24, 0.55)",
          }}
        />
      ) : null}
      <div
        className="absolute z-[81] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl bg-card p-4 text-card-foreground shadow-xl ring-1 ring-border"
        style={{ top: cardTop, left: cardLeft }}
      >
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Step {index + 1} of {total}
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${((index + 1) / total) * 100}%` }}
            aria-hidden
          />
        </div>
        <h2 id="tutorial-title" className="mt-3 font-heading text-lg font-semibold text-foreground">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        {!hole && ready ? (
          <p className="mt-2 rounded-xl bg-muted/70 px-2.5 py-1.5 text-xs text-muted-foreground">
            This piece is not on the screen right now, so here is a short note instead. Nothing in this tour changes real data.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" className="min-h-10 rounded-full px-3 text-sm" onClick={onExit}>
            Exit
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10 rounded-full"
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              Back
            </Button>
            <Button type="button" className="min-h-10 rounded-full" onClick={() => go(index + 1)}>
              {index + 1 >= total ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TutorialIntro({ className }: { className?: string }) {
  const { steps, progress, start, resume, restart } = useTutorial();
  const started = progress.step > 0 || progress.done;
  return (
    <div className={cn("mx-auto max-w-xl space-y-4 p-4 sm:p-6", className)}>
      <div className="panel space-y-3 rounded-3xl p-5 sm:p-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">A short tour of Cora Connect</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This walkthrough shows you the real pages, one simple step at a time. It is only a guide — it never changes your
          contacts or visits. You can leave any time and come back to the same step.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          There are {steps.length} steps in this tour. Use Next, Back, or Exit on each card.
        </p>
        {progress.done ? (
          <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            You have already finished this tour. Start over any time if you want a refresher.
          </p>
        ) : started ? (
          <p className="rounded-2xl bg-muted/70 px-3 py-2 text-sm text-muted-foreground">
            You left at step {Math.min(progress.step + 1, steps.length)} of {steps.length}. Continue from there, or start over.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          {progress.done ? (
            <Button type="button" className="min-h-11 rounded-full" onClick={restart}>
              Start over
            </Button>
          ) : started ? (
            <>
              <Button type="button" className="min-h-11 rounded-full" onClick={resume}>
                Continue
              </Button>
              <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={restart}>
                Start over
              </Button>
            </>
          ) : (
            <Button type="button" className="min-h-11 rounded-full" onClick={start}>
              Start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
