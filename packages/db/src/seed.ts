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

/** ページネーション確認用に投入するお問い合わせ件数。 */
const CONTACT_COUNT = 120;

const lastNames = [
  "佐藤",
  "鈴木",
  "高橋",
  "田中",
  "渡辺",
  "伊藤",
  "山本",
  "中村",
  "小林",
  "加藤",
];
const firstNames = [
  "太郎",
  "花子",
  "一郎",
  "美咲",
  "健太",
  "由美",
  "翔",
  "彩",
  "大輔",
  "葵",
];
const titles = [
  "資料請求",
  "見積もり依頼",
  "不具合報告",
  "導入のご相談",
  "サポート希望",
  "料金についての質問",
  "機能のご要望",
  "アカウントについて",
  "その他お問い合わせ",
  "解約について",
];

/**
 * ページネーション確認用にお問い合わせを生成する。
 * createdAt を 1 件ごとに 1 時間ずつ過去へずらし、新しい順の並びが一意に定まるようにする
 * （同時刻だと desc の並びが安定せず、ページ境界がぶれるため）。
 */
function buildSampleContacts(): (typeof contacts.$inferInsert)[] {
  const now = Date.now();
  return Array.from({ length: CONTACT_COUNT }, (_, i) => {
    const name = `${lastNames[i % lastNames.length]}${firstNames[(i * 7) % firstNames.length]}`;
    const title = titles[i % titles.length];
    return {
      name,
      email: `contact${String(i + 1).padStart(3, "0")}@example.com`,
      title: `${title}（#${i + 1}）`,
      message: `${name}です。「${title}」の件でご連絡しました。確認をお願いします。`,
      createdAt: new Date(now - i * 60 * 60 * 1000),
    };
  });
}

const sampleContacts = buildSampleContacts();

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
