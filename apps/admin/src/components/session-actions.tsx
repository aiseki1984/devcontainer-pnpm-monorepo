"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiPost } from "../lib/client-api";
import { toErrorMessage } from "../lib/error-message";

/**
 * 表示用のセッション1件分。日時は**サーバー側で整形済みの文字列**を受け取る。
 * クライアントで new Date().toLocaleString() すると SSR(UTC)とブラウザ(ローカルTZ)で
 * 文字列が食い違い hydration mismatch になるため、整形はサーバーに寄せる。
 */
export type Session = {
  id: number;
  createdAtLabel: string;
  expiresAtLabel: string;
};

/**
 * ユーザーのアクティブなログインセッション一覧 + 失効操作（クライアント）。
 *
 * mutation の pending/error は React 標準の useActionState で扱う（RHF フォームとは
 * 別系統の「アクション」パターンの例）。action の戻り値がそのまま state＝エラー文言になり、
 * isPending が処理中フラグになる。成功時は router.refresh() でサーバ側の一覧を取り直す。
 * isPending は全体共有なので、どのボタンを押したかは pendingTarget で別途持ってラベルに使う。
 */
export function SessionActions({
  userId,
  sessions,
}: {
  userId: number;
  sessions: Session[];
}) {
  const router = useRouter();
  // 「失効中…」ラベルをどのボタンに出すか（isPending は全体共有なので別途保持）。
  const [pendingTarget, setPendingTarget] = useState<"all" | number | null>(
    null,
  );

  const [error, submitRevoke, isPending] = useActionState<
    string | null,
    "all" | number
  >(async (_prev, target) => {
    const path =
      target === "all"
        ? `/admin/users/${userId}/sessions/revoke`
        : `/admin/users/${userId}/sessions/${target}/revoke`;
    const res = await adminApiPost(path);
    if (!res.ok) {
      return toErrorMessage(await res.json(), "失効に失敗しました。");
    }
    router.refresh();
    return null;
  }, null);

  function revoke(target: "all" | number) {
    setPendingTarget(target);
    submitRevoke(target);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-medium">
          アクティブなセッション
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {sessions.length} 件
          </span>
        </h2>
        {sessions.length > 0 && (
          <button
            onClick={() => revoke("all")}
            disabled={isPending}
            className="rounded-full border border-red-600/40 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-600/[.06] disabled:opacity-50 dark:text-red-400"
          >
            {isPending && pendingTarget === "all"
              ? "失効中…"
              : "全セッションを失効"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">
          有効なセッションはありません（ログインしていないか、すべて失効済み）。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-black/[.08] bg-white px-4 py-3 text-sm dark:border-white/[.145] dark:bg-zinc-950"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-zinc-600 dark:text-zinc-400">
                  発行: {session.createdAtLabel}
                </span>
                <span className="text-xs text-zinc-500">
                  期限: {session.expiresAtLabel}
                </span>
              </div>
              <button
                onClick={() => revoke(session.id)}
                disabled={isPending}
                className="shrink-0 rounded-full border border-black/[.12] px-3 py-1 transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.2] dark:hover:bg-white/[.06]"
              >
                {isPending && pendingTarget === session.id ? "失効中…" : "失効"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
