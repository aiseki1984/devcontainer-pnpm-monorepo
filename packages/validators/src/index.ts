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
