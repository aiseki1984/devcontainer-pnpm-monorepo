"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { loginSchema, type LoginInput } from "@pnpm-test-workspace/validators";
import { API_URL } from "../../lib/api";
import { toErrorMessage, type ErrorBody } from "../../lib/error-message";
import { useAuth } from "../../components/auth-provider";

// 開発用にデフォルトの管理者アカウントを用意しています。
// 本番環境ではこのアカウントは使用しないでください。
const DEFAULT_ADMIN = {
  email: "admin@example.com",
  password: "adminpass",
};

export default function AdminLoginPage() {
  const router = useRouter();
  const { reload } = useAuth();
  // 入力検証は validators の loginSchema を resolver に渡して共有する
  // （フロントとバックで同じスキーマ＝検証ルールの単一ソース）。
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: DEFAULT_ADMIN,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await fetch(`${API_URL}/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Cookie を送受信する
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        setError("root", {
          message: toErrorMessage(
            (await res.json().catch(() => null)) as ErrorBody | null,
            "ログインに失敗しました",
          ),
        });
        return;
      }
      await reload();
      router.push("/dashboard");
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
        <h1 className="text-2xl font-semibold tracking-tight">
          管理者ログイン
        </h1>

        {errors.root && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errors.root.message}
          </p>
        )}

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
          パスワード
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
          {isSubmitting ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
