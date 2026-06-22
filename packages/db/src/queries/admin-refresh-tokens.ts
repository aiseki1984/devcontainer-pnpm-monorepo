import { and, eq, isNull } from "drizzle-orm";
import { db } from "../client.js";
import { adminRefreshTokens } from "../schema.js";

/** 管理者のリフレッシュトークン1行分。形は user 版と同じ（別テーブル）。 */
export type AdminRefreshToken = typeof adminRefreshTokens.$inferSelect;

/** 発行時に渡す形。id・revoked_at・created_at は DB 側で付与する。 */
export interface NewAdminRefreshToken {
  adminId: number;
  tokenHash: string;
  expiresAt: Date;
}

/** リフレッシュトークンを保存し、作成された行を返す。 */
export async function createAdminRefreshToken(
  input: NewAdminRefreshToken,
): Promise<AdminRefreshToken> {
  const [created] = await db
    .insert(adminRefreshTokens)
    .values(input)
    .returning();
  return created;
}

/**
 * token_hash で引く。存在しなければ null。
 * 失効済み（revoked_at）・期限切れ（expires_at）の判定は呼び出し側（api）で行う。
 */
export async function findAdminRefreshTokenByHash(
  tokenHash: string,
): Promise<AdminRefreshToken | null> {
  const [row] = await db
    .select()
    .from(adminRefreshTokens)
    .where(eq(adminRefreshTokens.tokenHash, tokenHash));
  return row ?? null;
}

/** 1件を失効させる（ローテーションで古いトークンを使い捨てにする）。有効なものだけ更新。 */
export async function revokeAdminRefreshToken(id: number): Promise<void> {
  await db
    .update(adminRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(adminRefreshTokens.id, id), isNull(adminRefreshTokens.revokedAt)),
    );
}

/** ある管理者の有効な全トークンを失効させる（使い回し検知時やログアウト時の防御）。 */
export async function revokeAllAdminRefreshTokens(
  adminId: number,
): Promise<void> {
  await db
    .update(adminRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(adminRefreshTokens.adminId, adminId),
        isNull(adminRefreshTokens.revokedAt),
      ),
    );
}
