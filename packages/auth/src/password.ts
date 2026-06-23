import { hash, verify } from "@node-rs/argon2";

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
