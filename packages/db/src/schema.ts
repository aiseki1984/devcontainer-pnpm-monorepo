import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** created_at / updated_at の共通カラム。updated_at は更新時に自動で現在時刻へ。 */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/** お問い合わせ。フォーム送信内容をそのまま保存する。 */
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** 一般ユーザー。パスワードはハッシュ化して保存する（平文は持たない）。 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  // プロフィール画像のオブジェクトストレージ上のキー（{userId}/{uuid}.{ext}）。
  // 未設定なら NULL。表示 URL ではなくキーだけを持ち、presigned GET は都度発行する。
  avatarKey: text("avatar_key"),
  ...timestamps,
});

/**
 * マイギャラリー画像（非公開）。1 ユーザーが複数枚を持つ（users への 1:N）。
 * 本体バイトはオブジェクトストレージ（非公開バケット）に置き、ここには **ポインタ + メタ**
 * だけを持つ（BLOB は持たない）。表示は presigned GET URL を都度発行する。
 * user_id は所有者で、認可（このレコードが本人の物か）の根拠になる。
 */
export const galleryImages = pgTable(
  "gallery_images",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // 元ファイル名（任意・表示/ダウンロード用メタ）。
    originalName: text("original_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("gallery_images_user_id_idx").on(t.userId)],
);

/** 管理者。一般ユーザー（users）とは別テーブルで管理する。形は users と同じ。 */
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  ...timestamps,
});

/**
 * リフレッシュトークンの共通カラム。所有者 FK（user_id / admin_id）は
 * テーブルごとに付ける。opaque なランダム文字列の SHA-256 ハッシュだけを保存し、
 * 1 回使うとローテーションで失効させて新しい行を発行する（使い捨て）。
 * revoked_at は「いつ失効したか」を持つ。NULL なら有効（boolean より監査に強い）。
 *
 * オブジェクトではなく関数なのは、.unique() がテーブル名から制約名を生成するため。
 * ビルダのインスタンスを共有すると両テーブルで制約名が衝突するので、呼び出しごとに
 * 新しいビルダを生成する。
 */
const refreshTokenColumns = () => ({
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** 一般ユーザーのリフレッシュトークン。user_id で users を参照。 */
export const userRefreshTokens = pgTable(
  "user_refresh_tokens",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...refreshTokenColumns(),
  },
  (t) => [
    index("user_refresh_tokens_user_id_idx").on(t.userId),
    // 有効セッションの一覧・集計（revoked_at IS NULL の行だけを user_id で引く）を速くする
    // 部分インデックス。単一使用ローテーションで失効済み行が溜まっても走査対象を絞れる。
    index("user_refresh_tokens_active_idx")
      .on(t.userId)
      .where(sql`revoked_at IS NULL`),
  ],
);

/** 管理者のリフレッシュトークン。形は user 版と同じで admin_id で admins を参照。 */
export const adminRefreshTokens = pgTable(
  "admin_refresh_tokens",
  {
    adminId: integer("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    ...refreshTokenColumns(),
  },
  (t) => [index("admin_refresh_tokens_admin_id_idx").on(t.adminId)],
);
