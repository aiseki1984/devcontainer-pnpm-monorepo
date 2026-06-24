"use client";

import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, type ZodType } from "zod";
import { useRouter } from "next/navigation";
import { apiPost } from "./client-api";
import { toErrorMessage, type ErrorBody } from "./error-message";
import { useAuth } from "../components/auth-provider";

/**
 * 認証フォーム（ログイン）共通のロジック。
 * - 入力検証は validators の Zod スキーマを resolver に共有（フロント／バック単一ソース）
 * - 送信は apiPost（JSON + Cookie 同送）。失敗は setError("root") に集約
 * - 成功時は認証状態を取り直して（reload）保護ページへ遷移
 *
 * フォームごとに違うのは schema / endpoint / defaultValues / 遷移先 / 失敗時の既定文言だけ。
 */
export function useAuthForm<S extends ZodType<FieldValues, FieldValues>>({
  schema,
  endpoint,
  defaultValues,
  fallbackError,
  redirectTo,
}: {
  schema: S;
  endpoint: string;
  defaultValues: DefaultValues<z.input<S>>;
  fallbackError: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const { reload } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await apiPost(endpoint, values);
      if (!res.ok) {
        setError("root", {
          message: toErrorMessage(
            (await res.json().catch(() => null)) as ErrorBody | null,
            fallbackError,
          ),
        });
        return;
      }
      // 成功（Cookie 発行済み）。認証状態を取り直してから保護ページへ。
      await reload();
      router.push(redirectTo);
    } catch {
      setError("root", { message: "通信に失敗しました" });
    }
  });

  return { register, onSubmit, errors, isSubmitting };
}
