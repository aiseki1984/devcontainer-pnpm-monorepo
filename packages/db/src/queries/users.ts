import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { users } from "../schema.js";

/** 一般ユーザー1行分の形。password_hash を含むので外部にそのまま返さない。 */
export type User = typeof users.$inferSelect;

/** users への insert に渡せる形（id・timestamps は DB 側で付与）。 */
export type NewUser = typeof users.$inferInsert;

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

/** ユーザーを作成し、作成された行を返す。 */
export async function createUser(input: NewUser): Promise<User> {
  const [created] = await db.insert(users).values(input).returning();
  return created;
}
