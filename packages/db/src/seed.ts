/**
 * 開発用のサンプルデータ投入スクリプト。
 *
 * 実行: pnpm db:seed   （root で dotenv 経由・DATABASE_URL を読み込む）
 * 冪等にするため、既存の contacts を消してから入れ直す。
 * 本番では使わない。
 */
import { hashPassword } from "@pnpm-test-workspace/auth";
import { db } from "./client.js";
import { admins, contacts, users } from "./schema.js";

/** 開発用の管理者。自己登録は無いので seed で投入する。 */
const sampleAdmin = {
  name: "管理者",
  email: "admin@example.com",
  password: "adminpass",
};

/** 開発用の一般ユーザー。register でも作れるが、初期確認用に seed で投入しておく。 */
const sampleUser = {
  name: "山田太郎",
  email: "taro@example.com",
  password: "supersecret",
};

const sampleContacts: (typeof contacts.$inferInsert)[] = [
  {
    name: "佐藤太郎",
    email: "taro@example.com",
    title: "資料請求",
    message: "サービスの資料を送ってください。",
  },
  {
    name: "鈴木花子",
    email: "hanako@example.com",
    title: "見積もり依頼",
    message: "導入費用の見積もりをお願いします。",
  },
  {
    name: "山田一郎",
    email: "ichiro@example.com",
    title: "不具合報告",
    message: "送信ボタンが反応しないことがあります。",
  },
];

async function seed() {
  console.log("[seed] clearing contacts ...");
  await db.delete(contacts);

  console.log(`[seed] inserting ${sampleContacts.length} contacts ...`);
  const inserted = await db.insert(contacts).values(sampleContacts).returning();
  console.log(`[seed] ${inserted.length} contacts inserted.`);

  console.log("[seed] clearing admins ...");
  await db.delete(admins); // admin_refresh_tokens は FK cascade で消える

  console.log("[seed] inserting admin ...");
  const passwordHash = await hashPassword(sampleAdmin.password);
  await db.insert(admins).values({
    name: sampleAdmin.name,
    email: sampleAdmin.email,
    passwordHash,
  });
  console.log(
    `[seed] admin: ${sampleAdmin.email} / ${sampleAdmin.password} (dev only)`,
  );

  console.log("[seed] clearing users ...");
  await db.delete(users); // user_refresh_tokens は FK cascade で消える

  console.log("[seed] inserting user ...");
  const userPasswordHash = await hashPassword(sampleUser.password);
  await db.insert(users).values({
    name: sampleUser.name,
    email: sampleUser.email,
    passwordHash: userPasswordHash,
  });
  console.log(
    `[seed] user: ${sampleUser.email} / ${sampleUser.password} (dev only)`,
  );
  console.log("[seed] done.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
