import { z } from "zod";

/**
 * フロントと API で共有するバリデーション schema。
 * ここで定義した schema から型も導出し、入力の検証と型付けを一元化する。
 */

export const emailSchema = z.email();

/** お問い合わせフォーム。web の入力検証と api の受信検証で共有する。 */
export const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
});
export type ContactInput = z.infer<typeof contactSchema>;

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
