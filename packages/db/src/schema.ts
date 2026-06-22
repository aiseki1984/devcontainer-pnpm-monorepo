import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
