"use client";

// global-error はルートレイアウトを置き換えるため、自前で html/body を持つ。
export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          エラーが発生しました
        </h1>
        <button onClick={reset} className="font-medium underline">
          再試行
        </button>
      </body>
    </html>
  );
}
