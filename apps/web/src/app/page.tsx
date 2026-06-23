import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight">
        MyApp へようこそ
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        pnpm
        モノレポのサンプルアプリです。上部のナビからログイン・お問い合わせ・マイページへ移動できます。
      </p>
      <div className="flex gap-3 text-sm">
        <Link
          href="/contact"
          className="rounded-full bg-foreground px-5 py-2.5 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          お問い合わせ
        </Link>
        <Link
          href="/mypage"
          className="rounded-full border border-black/[.12] px-5 py-2.5 font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.06]"
        >
          マイページ
        </Link>
      </div>
    </main>
  );
}
