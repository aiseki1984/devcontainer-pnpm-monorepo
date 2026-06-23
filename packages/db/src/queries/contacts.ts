import { count, desc, eq } from "drizzle-orm";
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

/**
 * お問い合わせを新しい順に 1 ページ分だけ取得する。
 * createdAt が同値でも並びが安定するよう id を第 2 ソートキーにする（ページ境界のぶれ防止）。
 */
export function listContactsPage({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}): Promise<Contact[]> {
  return db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.createdAt), desc(contacts.id))
    .limit(limit)
    .offset(offset);
}

/** お問い合わせの総件数（ページ総数の算出に使う）。 */
export async function countContacts(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(contacts);
  return row?.value ?? 0;
}

/** お問い合わせを id で 1 件取得する。存在しなければ null。 */
export async function getContactById(id: number): Promise<Contact | null> {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
  return row ?? null;
}
