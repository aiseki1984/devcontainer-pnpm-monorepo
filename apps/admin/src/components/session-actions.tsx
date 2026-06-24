"use client";

import { useState } from "react";
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
 * 失効は API への直 fetch（cookie 同送）で行い、成功後は router.refresh() で
 * サーバ側の一覧を取り直す。mutation の pending/error は useState で素朴に持つ
 * （フォーム基盤ステップで useActionState に置き換える前提のミニマル実装）。
 */
export function SessionActions({
  userId,
  sessions,
}: {
  userId: number;
  sessions: Session[];
}) {
  const router = useRouter();
  // 操作中の対象（"all" または セッション id）。二重押下防止と行ごとの無効化に使う。
  const [pending, setPending] = useState<"all" | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(target: "all" | number) {
    setError(null);
    setPending(target);
    try {
      const path =
        target === "all"
          ? `/admin/users/${userId}/sessions/revoke`
          : `/admin/users/${userId}/sessions/${target}/revoke`;
      const res = await adminApiPost(path);
      if (!res.ok) {
        setError(toErrorMessage(await res.json(), "失効に失敗しました。"));
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
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
            disabled={pending !== null}
            className="rounded-full border border-red-600/40 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-600/[.06] disabled:opacity-50 dark:text-red-400"
          >
            {pending === "all" ? "失効中…" : "全セッションを失効"}
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
                disabled={pending !== null}
                className="shrink-0 rounded-full border border-black/[.12] px-3 py-1 transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.2] dark:hover:bg-white/[.06]"
              >
                {pending === session.id ? "失効中…" : "失効"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
