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
 * ログイン。password は「空でない」だけ確認する。
 * 最小長などのルールは登録時の責務であり、ログインで強制すると無意味に拒否したり
 * ルールを露呈したりするため、ここでは緩くする（照合は保存ハッシュで行う）。
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;
