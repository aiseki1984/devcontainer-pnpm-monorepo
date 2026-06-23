"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";
import { toErrorMessage, type ErrorBody } from "../../lib/error-message";
import { useAuth } from "../../components/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { reload } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        setError(
          toErrorMessage(
            (await res.json().catch(() => null)) as ErrorBody | null,
            "登録に失敗しました",
          ),
        );
        return;
      }
      // 登録成功時はそのままログイン済み（Cookie 発行済み）。状態を取り直して保護ページへ。
      await reload();
      router.push("/mypage");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <h1 className="text-2xl font-semibold tracking-tight">新規登録</h1>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          名前
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          パスワード（8 文字以上）
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-11 rounded-full bg-foreground font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {pending ? "登録中…" : "登録"}
        </button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          すでにアカウントがある場合は{" "}
          <Link href="/login" className="font-medium underline">
            ログイン
          </Link>
        </p>
      </form>
    </main>
  );
}
