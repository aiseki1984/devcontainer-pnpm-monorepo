import { and, eq, isNull } from "drizzle-orm";
import { db } from "../client.js";
import { userRefreshTokens } from "../schema.js";

/** 一般ユーザーのリフレッシュトークン1行分。token_hash のみ保持（生トークンは持たない）。 */
export type UserRefreshToken = typeof userRefreshTokens.$inferSelect;

/** 発行時に渡す形。id・revoked_at・created_at は DB 側で付与する。 */
export interface NewUserRefreshToken {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}

/** リフレッシュトークンを保存し、作成された行を返す。 */
export async function createUserRefreshToken(
  input: NewUserRefreshToken,
): Promise<UserRefreshToken> {
  const [created] = await db
    .insert(userRefreshTokens)
    .values(input)
    .returning();
  return created;
}

/**
 * token_hash で引く。存在しなければ null。
 * 失効済み（revoked_at）・期限切れ（expires_at）の判定は呼び出し側（api）で行う。
 */
export async function findUserRefreshTokenByHash(
  tokenHash: string,
): Promise<UserRefreshToken | null> {
  const [row] = await db
    .select()
    .from(userRefreshTokens)
    .where(eq(userRefreshTokens.tokenHash, tokenHash));
  return row ?? null;
}

/**
 * 1件を失効させる（ローテーションで古いトークンを使い捨てにする）。
 * 有効（revoked_at IS NULL）な行だけを更新し、実際に失効できたかを返す。
 * 条件付き UPDATE は原子的なので、同時リクエストでは 1 つだけが true を得る
 * → 1 トークンから複数セッションが発行されるのを防げる。
 */
export async function revokeUserRefreshToken(id: number): Promise<boolean> {
  const revoked = await db
    .update(userRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(userRefreshTokens.id, id), isNull(userRefreshTokens.revokedAt)),
    )
    .returning({ id: userRefreshTokens.id });
  return revoked.length > 0;
}

/** あるユーザーの有効な全トークンを失効させる（使い回し検知時やログアウト時の防御）。 */
export async function revokeAllUserRefreshTokens(
  userId: number,
): Promise<void> {
  await db
    .update(userRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userRefreshTokens.userId, userId),
        isNull(userRefreshTokens.revokedAt),
      ),
    );
}
