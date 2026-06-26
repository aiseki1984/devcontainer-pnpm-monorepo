"use client";

import { useEffect, useRef, useState } from "react";
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
// 実アップロードのサイズ強制は presigned POST の content-length-range、MIME 強制は
// 署名の Content-Type 固定＋保存前の magic number 検証が担うので、ここは UX 用。
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

type PresignResponse = {
  url: string;
  fields: Record<string, string>;
  key: string;
};
type AvatarUrlResponse = { url: string | null };

/**
 * プロフィール画像のアップロード（方式 A: presigned POST）。
 *
 * 1. POST /me/avatar/presign で署名済み POST 先・フォームフィールド・キーを得る
 * 2. ブラウザから Garage へ直接 multipart POST（バイトは API を経由しない）。
 *    サイズ上限は POST ポリシーの content-length-range が実強制する。
 * 3. PATCH /me でキーを保存（サーバが magic number で内容を検証）
 * 4. GET /me/avatar で表示用 presigned GET URL を取り直して反映
 */
export function AvatarUploader({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  // 選択直後のローカルプレビュー。アップロードはせず blob URL を表示するだけ。
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // 現在の blob URL を保持し revoke するための ref。参照はイベントハンドラと
  // アンマウント時の cleanup でのみ行い、render 中には触らない。
  const objectUrlRef = useRef<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AvatarFormValues>({
    resolver: zodResolver(avatarFormSchema),
  });

  // アンマウント時に未解放の blob URL を片付ける。
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // register の onChange を奪わずに（RHF の検証は残す）プレビュー生成を差し込む。
  const fileField = register("file");

  // 表示はプレビュー優先、無ければ保存済み URL。
  const displayUrl = previewUrl ?? currentUrl;

  // 選択ファイルからローカルプレビューを作る。前の blob を revoke してから新規生成する。
  // onChange（イベント）からのみ呼ぶ。
  const showLocalPreview = (file: File | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    // 許可形式かつサイズ内のときだけプレビュー。アップロードできないファイル
    // （非対応形式・サイズ超過）でプレビューを出すと「準備OK」に見えて紛らわしいので、
    // RHF の検証と同じ条件で弾く（検証エラー自体の表示は RHF に任せる）。
    const valid =
      file &&
      (AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type) &&
      file.size <= AVATAR_MAX_BYTES;
    const next = valid ? URL.createObjectURL(file) : null;
    objectUrlRef.current = next;
    setPreviewUrl(next);
  };

  const onSubmit = handleSubmit(async (values) => {
    const file = values.file[0];
    try {
      // 1) presigned POST（URL・フォームフィールド・キー）を取得
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
      const { url, fields, key } = (await presignRes.json()) as PresignResponse;

      // 2) Garage へ直接 multipart POST。署名フィールドを先に積み、file は最後に append する
      //    （S3 互換は file 以降のフィールドを無視するため順序が重要）。Content-Type は
      //    fields に含まれているので個別ヘッダは付けない（ブラウザが boundary を設定する）。
      const formData = new FormData();
      for (const [name, value] of Object.entries(fields)) {
        formData.append(name, value);
      }
      formData.append("file", file);
      const postRes = await fetch(url, { method: "POST", body: formData });
      if (!postRes.ok) {
        // サイズ超過は content-length-range 違反で Garage が 4xx を返す。
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

      // 4) 表示用 URL を取り直し、フォームを初期化してプレビュー表示を解除する
      //    （blob 自体は次の選択／アンマウント時に revoke される）。
      const avatarRes = await apiGet("/me/avatar");
      if (avatarRes.ok) {
        const { url } = (await avatarRes.json()) as AvatarUrlResponse;
        setCurrentUrl(url);
        reset();
        setPreviewUrl(null);
      }
    } catch {
      setError("root", { message: "通信に失敗しました" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-center gap-3">
      <div className="size-24 overflow-hidden rounded-full border border-black/[.12] bg-zinc-100 dark:border-white/[.2] dark:bg-zinc-900">
        {displayUrl ? (
          // presigned GET / blob プレビューの一時 URL のため next/image の最適化対象にしない。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
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
          {...fileField}
          onChange={(e) => {
            // RHF の onChange は残しつつ（検証のため）、ローカルプレビューを更新する。
            void fileField.onChange(e);
            showLocalPreview(e.target.files?.[0] ?? null);
          }}
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
