"use client";

/** Same pager Contacts uses (windowed page buttons). */
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  const windowed = Array.from({ length: pages }, (_, index) => index + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );
  return (
    <div className="flex items-center justify-end gap-1 px-3 py-3">
      {windowed.map((n, index) => (
        <span key={n} className="flex items-center">
          {index > 0 && windowed[index - 1] !== n - 1 ? <span className="px-1 text-mutedink">…</span> : null}
          <button
            type="button"
            onClick={() => onPage(n)}
            className={
              n === page
                ? "size-8 rounded-full bg-primary text-sm text-primary-foreground"
                : "size-8 rounded-full text-sm text-foreground hover:bg-muted"
            }
          >
            {n}
          </button>
        </span>
      ))}
    </div>
  );
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;
