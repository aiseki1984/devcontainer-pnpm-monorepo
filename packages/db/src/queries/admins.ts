import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { admins } from "../schema.js";

/** 管理者1行分の形。users とは別テーブルだが形は同じ。 */
export type Admin = typeof admins.$inferSelect;

/** admins への insert に渡せる形（id・timestamps は DB 側で付与）。 */
export type NewAdmin = typeof admins.$inferInsert;

/** email で管理者を引く。存在しなければ null。 */
export async function getAdminByEmail(email: string): Promise<Admin | null> {
  const [admin] = await db.select().from(admins).where(eq(admins.email, email));
  return admin ?? null;
}

/** 管理者を作成し、作成された行を返す（自己登録はせず seed / 管理操作で使う想定）。 */
export async function createAdmin(input: NewAdmin): Promise<Admin> {
  const [created] = await db.insert(admins).values(input).returning();
  return created;
}
