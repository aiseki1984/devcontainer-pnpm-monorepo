import { z } from "zod";

/**
 * フロントと API で共有するバリデーション schema。
 * ここで定義した schema から型も導出し、入力の検証と型付けを一元化する。
 */

// zod の既定エラーメッセージを日本語化する。validators は web/admin/api すべてが
// import する単一の zod インスタンスなので、ここで一度設定すれば front/back 共通で
// 日本語メッセージになる（RHF のフィールドエラー表示・API の 400 レスポンス両方）。
z.config(z.locales.ja());

// 組み込み ja ロケールは一部に型名（"string" 等）が残り UI 文言として不自然なので、
// フォームで頻出するケースだけ自然な日本語に上書きする。返さなかった issue は
// ja ロケールにフォールバックする。
z.config({
  customError: (issue) => {
    if (issue.code === "invalid_type") {
      return "入力してください";
    }
    if (issue.code === "too_small" && issue.origin === "string") {
      return `${issue.minimum}文字以上で入力してください`;
    }
    if (issue.code === "too_big" && issue.origin === "string") {
      return `${issue.maximum}文字以内で入力してください`;
    }
    if (issue.code === "invalid_format" && issue.format === "email") {
      return "メールアドレスの形式が正しくありません";
    }
    return undefined;
  },
});

export const emailSchema = z.email();

/** お問い合わせフォーム。web の入力検証と api の受信検証で共有する。 */
export const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
});
export type ContactInput = z.infer<typeof contactSchema>;

/**
 * リダイレクト先 `next` を検証し、同一オリジン内の安全なパス（pathname+search）だけを返す。
 * 文字列の前方一致（startsWith("/") かつ !startsWith("//")）では `/\evil.com` のような
 * バックスラッシュ入りがすり抜け、WHATWG URL が `\`→`/` 正規化して外部オリジンに解決される
 * （オープンリダイレクト）。そこで実際に URL へ解決し、origin 一致でのみ通す。
 * 不正・外部・解決不能なら fallback を返す。
 */
export function safeNextPath(
  raw: string | null | undefined,
  origin: string,
  fallback: string,
): string {
  if (!raw) return fallback;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== origin) return fallback;
  return url.pathname + url.search;
}

/**
 * 一覧取得のページネーション query。文字列の query を数値へ変換し、安全な範囲に収める。
 * 不正値（非数値・範囲外）は .catch でデフォルトに倒し、一覧 API が 400 で落ちないようにする。
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  perPage: z.coerce.number().int().min(1).max(100).catch(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

/** パスワード（ハッシュ前の平文）に対するルール。登録時に適用する。 */
export const passwordSchema = z.string().min(8).max(100);

/** 新規登録。user / admin で共通の形。web/admin の入力検証と api の受信検証で共有する。 */
export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * 画像ファイルの共通制約・ユーティリティ（avatar / gallery などで共有）。
 * 許可 MIME と拡張子マッピングの単一ソース。DB の text() では表現できないファイル制約なので
 * validators が持つ。サイズ上限は用途ごとに別（avatar は小さめ、gallery は大きめ）。
 */
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

/** MIME → 拡張子。オブジェクトキー生成に使う（storage 側のキー命名に渡す）。 */
const IMAGE_EXT_BY_MIME: Record<ImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** 許可済み画像 MIME から拡張子を引く。 */
export function imageExtForMime(mime: ImageMimeType): string {
  return IMAGE_EXT_BY_MIME[mime];
}

/**
 * オブジェクト先頭バイト（magic number）から実体の画像 MIME を判定する。
 * presigned POST/PUT は宣言 `Content-Type` しか縛れず中身は見ないため、保存前に
 * これで「宣言型と実体の一致」を検証する（`image/png` を名乗る HTML/SVG 等を弾く）。
 * WebP は RIFF コンテナ判定に 12 バイト要るので、呼び出し側は 12 バイト以上渡すこと。
 * 判定不能（許可外）なら null。
 */
export function sniffImageMime(head: Uint8Array): ImageMimeType | null {
  // JPEG: FF D8 FF
  if (
    head.length >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff
  ) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: "RIFF" (0-3) .... "WEBP" (8-11)
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** アバター画像（1枚・公開）の制約。 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
export const AVATAR_ALLOWED_MIME_TYPES = IMAGE_MIME_TYPES;

/**
 * presigned POST 発行リクエスト。クライアントがアップロード前にファイルの MIME と
 * サイズを申告し、API はこれを検証してから署名する。
 *
 * サイズの **実強制** は presigned POST の `content-length-range` 条件が担う（ここでの
 * size は早期に弾くための UX 用検証）。MIME は署名ポリシーの `Content-Type` 固定に加え、
 * 保存前の magic number 検証（{@link sniffImageMime}）で実体まで確認する。
 */
export const avatarPresignSchema = z.object({
  contentType: z.enum(AVATAR_ALLOWED_MIME_TYPES, {
    error: "対応していない画像形式です（JPEG / PNG / WebP）",
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(AVATAR_MAX_BYTES, {
      error: `画像サイズは ${AVATAR_MAX_BYTES / 1024 / 1024}MB 以内にしてください`,
    }),
});
export type AvatarPresignInput = z.infer<typeof avatarPresignSchema>;

/**
 * プロフィール更新（PATCH /me）。今はアバターのオブジェクトキー保存のみ。
 * キーが呼び出し元ユーザーのものかは API 側（認証済み id との突き合わせ）で検証する。
 */
export const updateMeSchema = z.object({
  avatarKey: z.string().min(1).max(256),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/**
 * マイギャラリー画像（複数・非公開）の制約。avatar より大きめを許可する。
 * 当面は画像のみ（PDF 等を許すなら IMAGE_MIME_TYPES とは別の許可リストに拡張する）。
 */
export const GALLERY_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB
export const GALLERY_ALLOWED_MIME_TYPES = IMAGE_MIME_TYPES;
/** ファイル名（任意・表示/ダウンロード用メタ）の最大長。 */
export const GALLERY_ORIGINAL_NAME_MAX = 255;

/** ギャラリー画像の presigned POST 発行リクエスト（avatar と同形）。 */
export const galleryPresignSchema = z.object({
  contentType: z.enum(GALLERY_ALLOWED_MIME_TYPES, {
    error: "対応していない画像形式です（JPEG / PNG / WebP）",
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(GALLERY_MAX_BYTES, {
      error: `画像サイズは ${GALLERY_MAX_BYTES / 1024 / 1024}MB 以内にしてください`,
    }),
});
export type GalleryPresignInput = z.infer<typeof galleryPresignSchema>;

/**
 * アップロード完了後のギャラリー画像メタ保存リクエスト。
 * objectKey が呼び出し元ユーザーの名前空間かは API 側でキー検証する。
 * contentType / size は表示用メタ（実体は API 側の magic number 検証で担保）。
 */
export const gallerySaveSchema = z.object({
  objectKey: z.string().min(1).max(256),
  contentType: z.enum(GALLERY_ALLOWED_MIME_TYPES, {
    error: "対応していない画像形式です（JPEG / PNG / WebP）",
  }),
  size: z.number().int().positive().max(GALLERY_MAX_BYTES),
  originalName: z.string().min(1).max(GALLERY_ORIGINAL_NAME_MAX).optional(),
});
export type GallerySaveInput = z.infer<typeof gallerySaveSchema>;

/**
 * ログイン。password は「空でない」だけ確認する。
 * 最小長などのルールは登録時の責務であり、ログインで強制すると無意味に拒否したり
 * ルールを露呈したりするため、ここでは緩くする（照合は保存ハッシュで行う）。
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;
