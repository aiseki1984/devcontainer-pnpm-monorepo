"use client";

import Link from "next/link";
import { loginSchema } from "@pnpm-test-workspace/validators";
import { useAuthForm } from "../../lib/use-auth-form";
import { TextField } from "../../components/text-field";

// 開発用にデフォルトのユーザーアカウントを用意しています。
// 本番環境ではこのアカウントは使用しないでください。
const DEFAULT_USER = {
  email: "taro@example.com",
  password: "supersecret",
};

export default function LoginPage() {
  const { register, onSubmit, errors, isSubmitting } = useAuthForm({
    schema: loginSchema,
    endpoint: "/auth/login",
    defaultValues: DEFAULT_USER,
    fallbackError: "ログインに失敗しました",
    redirectTo: "/mypage",
  });

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <h1 className="text-2xl font-semibold tracking-tight">ログイン</h1>

        {errors.root && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errors.root.message}
          </p>
        )}

        <TextField
          label="メールアドレス"
          type="email"
          registration={register("email")}
          error={errors.email}
        />
        <TextField
          label="パスワード"
          type="password"
          registration={register("password")}
          error={errors.password}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 h-11 rounded-full bg-foreground font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {isSubmitting ? "ログイン中…" : "ログイン"}
        </button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          アカウントがない場合は{" "}
          <Link href="/register" className="font-medium underline">
            新規登録
          </Link>
        </p>
      </form>
    </main>
  );
}
