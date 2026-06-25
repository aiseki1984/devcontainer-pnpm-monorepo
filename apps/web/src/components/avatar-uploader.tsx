"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
} from "@pnpm-test-workspace/validators";
import { apiGet, apiPatch, apiPost } from "../lib/client-api";

const MAX_MB = AVATAR_MAX_BYTES / 1024 / 1024;

// ブラウザ側の事前検証。制約値（許可 MIME・最大サイズ）は validators を単一ソースに流用する。
// 実アップロードの MIME 強制は presigned PUT の署名（ContentType）が担うので、ここは UX 用。
const avatarFormSchema = z.object({
  file: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, "画像を選択してください")
    .refine(
      (files) =>
        (AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(
          files?.[0]?.type,
        ),
      "対応していない画像形式です（JPEG / PNG / WebP）",
    )
    .refine(
      (files) => (files?.[0]?.size ?? 0) <= AVATAR_MAX_BYTES,
      `画像サイズは ${MAX_MB}MB 以内にしてください`,
    ),
});
type AvatarFormValues = z.infer<typeof avatarFormSchema>;

type PresignResponse = { uploadUrl: string; key: string };
type AvatarUrlResponse = { url: string | null };

/**
 * プロフィール画像のアップロード（方式 A: presigned PUT）。
 *
 * 1. POST /me/avatar/presign で署名済み PUT URL とキーを得る
 * 2. ブラウザから Garage へ直接 PUT（バイトは API を経由しない）
 * 3. PATCH /me でキーを保存
 * 4. GET /me/avatar で表示用 presigned GET URL を取り直して反映
 */
export function AvatarUploader({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AvatarFormValues>({
    resolver: zodResolver(avatarFormSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const file = values.file[0];
    try {
      // 1) presigned PUT URL を取得
      const presignRes = await apiPost("/me/avatar/presign", {
        contentType: file.type,
        size: file.size,
      });
      if (!presignRes.ok) {
        if (presignRes.status === 401) {
          router.push("/login");
          return;
        }
        setError("root", { message: "アップロードURLの取得に失敗しました" });
        return;
      }
      const { uploadUrl, key } = (await presignRes.json()) as PresignResponse;

      // 2) Garage へ直接 PUT。Content-Type は署名と一致させる必要がある。
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) {
        setError("root", { message: "画像のアップロードに失敗しました" });
        return;
      }

      // 3) キーを保存
      const patchRes = await apiPatch("/me", { avatarKey: key });
      if (!patchRes.ok) {
        if (patchRes.status === 401) {
          router.push("/login");
          return;
        }
        setError("root", { message: "保存に失敗しました" });
        return;
      }

      // 4) 表示用 URL を取り直す
      const avatarRes = await apiGet("/me/avatar");
      if (avatarRes.ok) {
        const { url } = (await avatarRes.json()) as AvatarUrlResponse;
        setCurrentUrl(url);
      }
    } catch {
      setError("root", { message: "通信に失敗しました" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-center gap-3">
      <div className="size-24 overflow-hidden rounded-full border border-black/[.12] bg-zinc-100 dark:border-white/[.2] dark:bg-zinc-900">
        {currentUrl ? (
          // presigned GET の一時 URL のため next/image の最適化対象にしない。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt="プロフィール画像"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-zinc-400">
            no image
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        プロフィール画像
        <input
          type="file"
          accept={AVATAR_ALLOWED_MIME_TYPES.join(",")}
          {...register("file")}
          className="text-xs file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1 file:text-background"
        />
        {errors.file && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {errors.file.message}
          </span>
        )}
      </label>

      {errors.root && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {isSubmitting ? "アップロード中…" : "アップロード"}
      </button>
    </form>
  );
}
