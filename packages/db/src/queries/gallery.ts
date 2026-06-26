import { and, desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { galleryImages } from "../schema.js";

/** ギャラリー画像 1 行分の形。 */
export type GalleryImage = typeof galleryImages.$inferSelect;

/** gallery_images への insert に渡せる形（id・createdAt は DB 側で付与）。 */
export type NewGalleryImage = typeof galleryImages.$inferInsert;

/** 外部に返してよい公開形（所有者 user_id は出さない）。 */
export type PublicGalleryImage = Pick<
  GalleryImage,
  | "id"
  | "objectKey"
  | "contentType"
  | "sizeBytes"
  | "originalName"
  | "createdAt"
>;

/** 公開列だけを選ぶ select 句。user_id を境界で 1 回だけ落とすために共通化。 */
const publicGalleryColumns = {
  id: galleryImages.id,
  objectKey: galleryImages.objectKey,
  contentType: galleryImages.contentType,
  sizeBytes: galleryImages.sizeBytes,
  originalName: galleryImages.originalName,
  createdAt: galleryImages.createdAt,
} as const;

/** ギャラリー画像を 1 件作成し、作成された公開形を返す。 */
export async function createGalleryImage(
  input: NewGalleryImage,
): Promise<PublicGalleryImage> {
  const [created] = await db
    .insert(galleryImages)
    .values(input)
    .returning(publicGalleryColumns);
  return created;
}

/**
 * あるユーザーのギャラリー画像を新しい順に返す。
 * createdAt 同値でも安定するよう id を第 2 ソートキーにする。
 * （ギャラリーは 1 ユーザーあたり小規模想定なので当面ページングはしない。）
 */
export function listGalleryImagesByUser(
  userId: number,
): Promise<PublicGalleryImage[]> {
  return db
    .select(publicGalleryColumns)
    .from(galleryImages)
    .where(eq(galleryImages.userId, userId))
    .orderBy(desc(galleryImages.createdAt), desc(galleryImages.id));
}

/**
 * 自分のギャラリー画像を 1 件削除し、削除した行の objectKey を返す（無ければ null）。
 * `id` と `user_id` の AND 条件で削除することで **所有権チェックを兼ねる**
 * （他人の id を指定しても 0 件削除＝null になり、存在も漏らさない）。
 * 返した objectKey でオブジェクトストレージ側を後始末する。
 */
export async function deleteGalleryImage(
  id: number,
  userId: number,
): Promise<string | null> {
  const [deleted] = await db
    .delete(galleryImages)
    .where(and(eq(galleryImages.id, id), eq(galleryImages.userId, userId)))
    .returning({ objectKey: galleryImages.objectKey });
  return deleted?.objectKey ?? null;
}
