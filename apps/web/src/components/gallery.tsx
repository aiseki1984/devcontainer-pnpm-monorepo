"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GALLERY_ALLOWED_MIME_TYPES,
  GALLERY_MAX_BYTES,
} from "@pnpm-test-workspace/validators";
import { apiDelete, apiPost } from "../lib/client-api";

/** API が返すギャラリー画像（表示用 presigned URL 付き）。 */
export type GalleryImage = {
  id: number;
  url: string;
  originalName: string | null;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

type PresignResponse = {
  url: string;
  fields: Record<string, string>;
  key: string;
};
type SaveResponse = { image: GalleryImage };

const MAX_MB = GALLERY_MAX_BYTES / 1024 / 1024;

/**
 * マイギャラリー（非公開）。複数の私的画像をアップロード/一覧/削除する。
 *
 * アップロード: presigned POST で直接 Garage（非公開バケット）へ → メタ保存（サーバが
 * magic number で内容検証）。表示は API が都度発行する presigned GET URL。
 */
export function Gallery({ initialImages }: { initialImages: GalleryImage[] }) {
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    // 同じファイルを連続で選べるよう値をクリアしておく。
    e.target.value = "";
    if (!file) return;

    // クライアント側の事前検証（制約は validators が単一ソース。実強制はサーバ/署名側）。
    if (
      !(GALLERY_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)
    ) {
      setError("対応していない画像形式です（JPEG / PNG / WebP）");
      return;
    }
    if (file.size > GALLERY_MAX_BYTES) {
      setError(`画像サイズは ${MAX_MB}MB 以内にしてください`);
      return;
    }

    setBusy(true);
    try {
      // 1) presigned POST を取得
      const presignRes = await apiPost("/me/gallery/presign", {
        contentType: file.type,
        size: file.size,
      });
      if (!presignRes.ok) {
        if (presignRes.status === 401) {
          router.push("/login");
          return;
        }
        setError("アップロードURLの取得に失敗しました");
        return;
      }
      const { url, fields, key } = (await presignRes.json()) as PresignResponse;

      // 2) Garage へ直接 multipart POST（署名フィールド → file の順）
      const formData = new FormData();
      for (const [name, value] of Object.entries(fields)) {
        formData.append(name, value);
      }
      formData.append("file", file);
      const postRes = await fetch(url, { method: "POST", body: formData });
      if (!postRes.ok) {
        setError("画像のアップロードに失敗しました");
        return;
      }

      // 3) メタ保存（サーバが内容検証 → DB 行作成 → presigned URL 付きで返す）
      const saveRes = await apiPost("/me/gallery", {
        objectKey: key,
        contentType: file.type,
        size: file.size,
        originalName: file.name,
      });
      if (!saveRes.ok) {
        if (saveRes.status === 401) {
          router.push("/login");
          return;
        }
        setError("保存に失敗しました");
        return;
      }
      const { image } = (await saveRes.json()) as SaveResponse;
      setImages((prev) => [image, ...prev]);
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: number) => {
    setError(null);
    const snapshot = images;
    // 楽観的に消す。失敗したら戻す。
    setImages((cur) => cur.filter((img) => img.id !== id));
    const res = await apiDelete(`/me/gallery/${id}`);
    if (!res.ok) {
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      setImages(snapshot);
      setError("削除に失敗しました");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        画像を追加（JPEG / PNG / WebP・{MAX_MB}MB まで）
        <input
          type="file"
          accept={GALLERY_ALLOWED_MIME_TYPES.join(",")}
          disabled={busy}
          onChange={onSelect}
          className="text-xs file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1 file:text-background disabled:opacity-50"
        />
      </label>

      {busy && <p className="text-xs text-zinc-500">アップロード中…</p>}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {images.length === 0 ? (
        <p className="text-sm text-zinc-400">まだ画像がありません。</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <li
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-black/[.08] bg-zinc-100 dark:border-white/[.145] dark:bg-zinc-900"
            >
              {/* presigned GET の一時 URL のため next/image の最適化対象にしない。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.originalName ?? "ギャラリー画像"}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => onDelete(img.id)}
                aria-label="削除"
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
