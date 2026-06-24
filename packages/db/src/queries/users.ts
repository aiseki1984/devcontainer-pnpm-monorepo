import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../client.js";
import { users, userRefreshTokens } from "../schema.js";

/** 一般ユーザー1行分の形。password_hash を含むので外部にそのまま返さない。 */
export type User = typeof users.$inferSelect;

/** users への insert に渡せる形（id・timestamps は DB 側で付与）。 */
export type NewUser = typeof users.$inferInsert;

/** 外部に返してよいユーザーの公開形。password_hash 等の秘匿列を含めない。 */
export type PublicUser = Pick<User, "id" | "email" | "name" | "createdAt">;

/**
 * 一覧表示用の安全なユーザー形。
 * activeSessionCount = 有効なログインセッション（refresh token）数。
 */
export type UserListRow = PublicUser & {
  activeSessionCount: number;
};

/** 公開列だけを選ぶ select 句（passwordHash を境界で1回だけ落とすために共通化）。 */
const publicUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  createdAt: users.createdAt,
} as const;

/** email でユーザーを引く。存在しなければ null。 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user ?? null;
}

/** id でユーザーを引く。存在しなければ null（リフレッシュ時の再取得などで使う）。 */
export async function getUserById(id: number): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

/**
 * id で「公開してよい列だけ」のユーザーを引く。存在しなければ null。
 * password_hash を含む getUserById をそのまま外部へ返すと漏洩しうるので、
 * 管理画面のユーザー詳細などはこちらを使い、秘匿列を DB 境界で落とす。
 */
export async function getUserPublicById(
  id: number,
): Promise<PublicUser | null> {
  const [user] = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.id, id));
  return user ?? null;
}

/** ユーザーを作成し、作成された行を返す。 */
export async function createUser(input: NewUser): Promise<User> {
  const [created] = await db.insert(users).values(input).returning();
  return created;
}

/**
 * ユーザーを新しい順に 1 ページ分だけ取得する（管理画面のユーザー一覧用）。
 * createdAt が同値でも並びが安定するよう id を第 2 ソートキーにする。
 * password_hash は select せず、一覧に必要な列だけを明示射影する。
 *
 * 有効セッション数は、ユーザーごとに count クエリを投げる（N+1）代わりに、
 * 有効な refresh token を LEFT JOIN して 1 クエリで集計する。
 * count(userRefreshTokens.id) は join に一致した行だけ数えるので、0 件なら 0 になる。
 */
export function listUsersPage({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}): Promise<UserListRow[]> {
  return db
    .select({
      ...publicUserColumns,
      activeSessionCount: count(userRefreshTokens.id),
    })
    .from(users)
    .leftJoin(
      userRefreshTokens,
      and(
        eq(userRefreshTokens.userId, users.id),
        isNull(userRefreshTokens.revokedAt),
        gt(userRefreshTokens.expiresAt, new Date()),
      ),
    )
    .groupBy(users.id)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit)
    .offset(offset);
}

/** ユーザーの総件数（ページ総数の算出に使う）。 */
export async function countUsers(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(users);
  return row?.value ?? 0;
}
