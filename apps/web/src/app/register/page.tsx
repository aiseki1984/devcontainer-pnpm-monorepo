"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  registerSchema,
  type RegisterInput,
} from "@pnpm-test-workspace/validators";
import { API_URL } from "../../lib/api";
import { toErrorMessage, type ErrorBody } from "../../lib/error-message";
import { useAuth } from "../../components/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { reload } = useAuth();
  // 入力検証は validators の registerSchema を resolver に渡して共有する
  // （フロントとバックで同じスキーマ＝検証ルールの単一ソース）。
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        setError("root", {
          message: toErrorMessage(
            (await res.json().catch(() => null)) as ErrorBody | null,
            "登録に失敗しました",
          ),
        });
        return;
      }
      // 登録成功時はそのままログイン済み（Cookie 発行済み）。状態を取り直して保護ページへ。
      await reload();
      router.push("/mypage");
    } catch {
      setError("root", { message: "通信に失敗しました" });
    }
  });

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <h1 className="text-2xl font-semibold tracking-tight">新規登録</h1>

        {errors.root && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errors.root.message}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          名前
          <input
            type="text"
            {...register("name")}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
          {errors.name && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {errors.name.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input
            type="email"
            {...register("email")}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
          {errors.email && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {errors.email.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          パスワード（8 文字以上）
          <input
            type="password"
            {...register("password")}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
          {errors.password && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {errors.password.message}
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 h-11 rounded-full bg-foreground font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {isSubmitting ? "登録中…" : "登録"}
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
