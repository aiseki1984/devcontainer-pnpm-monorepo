import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight">
        404 — ページが見つかりません
      </h1>
      <Link href="/dashboard" className="font-medium underline">
        ダッシュボードへ
      </Link>
    </main>
  );
}
