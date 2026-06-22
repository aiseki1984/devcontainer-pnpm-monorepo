/**
 * 開発用のサンプルデータ投入スクリプト。
 *
 * 実行: pnpm db:seed   （root で dotenv 経由・DATABASE_URL を読み込む）
 * 冪等にするため、既存の contacts を消してから入れ直す。
 * 本番では使わない。
 */
import { db } from "./client.js";
import { contacts } from "./schema.js";

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

  console.log(`[seed] done. ${inserted.length} rows inserted.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
