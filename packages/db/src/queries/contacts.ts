import { desc } from "drizzle-orm";
import { db } from "../client.js";
import { contacts } from "../schema.js";

/** insert に渡せるお問い合わせの形（id・createdAt は DB 側で付与）。 */
export type NewContact = typeof contacts.$inferInsert;

/** 保存済みのお問い合わせ1件分の形。 */
export type Contact = typeof contacts.$inferSelect;

/**
 * お問い合わせを保存し、作成された行を返す。
 * 返り値型を明示し、drizzle の内部型を公開 API 面に漏らさない。
 */
export async function createContact(input: NewContact): Promise<Contact> {
  const [created] = await db.insert(contacts).values(input).returning();
  return created;
}

/** お問い合わせを新しい順に取得する。 */
export function listContacts(): Promise<Contact[]> {
  return db.select().from(contacts).orderBy(desc(contacts.createdAt));
}
