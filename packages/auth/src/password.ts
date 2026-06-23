import { hash, verify } from "@node-rs/argon2";

/**
 * ログイン時、アカウント不在でも argon2 verify を実行して応答時間を寄せるための固定ハッシュ。
 * 平文は使わない開発用ダミー値（"dummy-password-for-login-timing"）で、認証成功には使わない。
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$/ETrneP+v2np+S++faFLGA$Jr+XmCKazbXyzfK9pTNkOC8wd3qBDbqvoywsMpQ15qg";

/**
 * パスワードを argon2 でハッシュ化する。
 * ソルトはハッシュ文字列（$argon2id$...）に内包されるので別カラムは不要。
 * 平文は保存も比較もしない。
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** 保存済みハッシュと入力平文を照合する。 */
export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
