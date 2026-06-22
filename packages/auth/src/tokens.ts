import { createHash, randomBytes } from "node:crypto";

/** 生成したリフレッシュトークン。生文字列とその SHA-256 ハッシュのペア。 */
export interface GeneratedRefreshToken {
  /** クライアントへ渡す生トークン（opaque）。DB には保存しない。 */
  token: string;
  /** DB に保存するハッシュ。生トークンから一方向に導出する。 */
  tokenHash: string;
}

/**
 * opaque なリフレッシュトークンを生成する。
 * 生トークンはクライアントにだけ渡し、DB には tokenHash だけを保存する。
 */
export function generateRefreshToken(): GeneratedRefreshToken {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashRefreshToken(token) };
}

/** 生トークンを SHA-256 でハッシュ化する（DB 照合用）。 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
