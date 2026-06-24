"use client";

import { loginSchema } from "@pnpm-test-workspace/validators";
import { useAuthForm } from "../../lib/use-auth-form";
import { TextField } from "../../components/text-field";

// 開発用にデフォルトの管理者アカウントを用意しています。
// 本番環境ではこのアカウントは使用しないでください。
const DEFAULT_ADMIN = {
  email: "admin@example.com",
  password: "adminpass",
};

export default function AdminLoginPage() {
  const { register, onSubmit, errors, isSubmitting } = useAuthForm({
    schema: loginSchema,
    endpoint: "/admin/auth/login",
    defaultValues: DEFAULT_ADMIN,
    fallbackError: "ログインに失敗しました",
    redirectTo: "/dashboard",
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
      </form>
    </main>
  );
}
