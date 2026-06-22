import { desc } from "drizzle-orm";
import { db } from "../client.js";
import { contacts } from "../schema.js";

/** insert に渡せるお問い合わせの形（id・createdAt は DB 側で付与）。 */
export type NewContact = typeof contacts.$inferInsert;

/** お問い合わせを保存し、作成された行を返す。 */
export async function createContact(input: NewContact) {
  const [created] = await db.insert(contacts).values(input).returning();
  return created;
}

/** お問い合わせを新しい順に取得する。 */
export function listContacts() {
  return db.select().from(contacts).orderBy(desc(contacts.createdAt));
}
