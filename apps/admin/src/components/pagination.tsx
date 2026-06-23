import Link from "next/link";

/**
 * ページ送り。URL の ?page= を切り替える純粋なリンク（サーバ側で再フェッチされる）。
 * basePath は遷移先のパス（例: "/contacts"）。
 */
export function Pagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const linkClass =
    "rounded-md border border-black/[.12] px-3 py-1.5 text-sm transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.06]";
  const disabledClass =
    "rounded-md border border-black/[.06] px-3 py-1.5 text-sm text-zinc-400 dark:border-white/[.08] dark:text-zinc-600";

  return (
    <nav className="flex items-center justify-between gap-4">
      {hasPrev ? (
        <Link href={`${basePath}?page=${page - 1}`} className={linkClass}>
          ← 前へ
        </Link>
      ) : (
        <span className={disabledClass}>← 前へ</span>
      )}

      <span className="text-sm text-zinc-500">
        {page} / {totalPages}
      </span>

      {hasNext ? (
        <Link href={`${basePath}?page=${page + 1}`} className={linkClass}>
          次へ →
        </Link>
      ) : (
        <span className={disabledClass}>次へ →</span>
      )}
    </nav>
  );
}
