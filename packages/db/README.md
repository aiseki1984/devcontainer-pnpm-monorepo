# @pnpm-test-workspace/db

アプリの永続化レイヤー。Drizzle のテーブル定義（schema）と DB クライアント（`db`）を提供する。
マイグレーションの生成・適用も drizzle-kit でこのパッケージから行う。

## ディレクトリ構造

```text
packages/db/
  package.json         @pnpm-test-workspace/db
  drizzle.config.ts
  tsconfig.json
  tsconfig.build.json  配布ビルド用（dist へ JS + .d.ts を出力）
  eslint.config.mjs
  src/
    schema.ts
    client.ts          DATABASE_URL から Drizzle クライアント（db）を作る
    queries/           ドメインごとのクエリヘルパー。drizzle を内側に隠す層。
    seed.ts            開発用サンプルデータ投入（pnpm db:seed・配布物には含めない）
    index.ts
  drizzle/
  dist/
```

## 使い方

```ts
import { db, contacts } from "@pnpm-test-workspace/db";

await db.insert(contacts).values(newContact);
```

insert / select の型はテーブル定義から導出できる（drizzle-zod は不要・後述）:

```ts
type NewContact = typeof contacts.$inferInsert;
type Contact = typeof contacts.$inferSelect;
```

## ビルドして配布する理由

このパッケージは [validators](../validators/README.md) と同じく、**`src` の TypeScript を直接 export せず、`tsc` でコンパイルした `dist`（JS + `.d.ts`）を `exports` で公開**している。

`db` と `schema` は api（本番）から**ランタイムで** import されるため、ソース（`.ts`）を直接 export すると次の問題が起きる:

- **api（本番）**: `node dist/index.js` 実行時に `.ts` を解決してしまい、Node が実行できず落ちる。
- **web**: Next.js は node_modules 内の `.ts` をデフォルトで変換しないため `transpilePackages` が必要になる。

`dist` を公開することで、消費側は追加設定なしで利用できる。

なお **drizzle-kit は `src` を直接見る**（[drizzle.config.ts](drizzle.config.ts) の `schema: "./src/schema.ts"`）。これはマイグレーション生成用の dev ツールなので src 直読みでよく、「消費側は dist / drizzle-kit は src」と役割が分かれるだけで矛盾しない。

## drizzle-zod は使わない

入力検証の zod schema は [validators](../validators) の `contactSchema` を単一ソースとし、**このパッケージの schema からは drizzle-zod で生成しない**。

理由は層（責務）が違うため:

- **validators** = **入力検証ルール**（`name` max100, `email` 形式チェックなど）。web のフォームと api の受信で共有するビジネスルール。
- **db の schema** = **永続化の形**。

決定的な理由として、テーブルのカラムは `text()` で長さの概念を持たないため、`createInsertSchema()` が生成するのはただの `z.string()` になり、`.min(1).max(100)` や `z.email()` といった**検証ルールが失われる**。結局 refine で付け直すことになり、validators の二重管理になるだけ。

また、フォーム検証を DB 構造に結合させると DB 都合の変更（カラム追加・rename）が検証に波及してしまう。依存の向きは「入力検証 → DB」であって逆ではない。

→ 入力検証は `contactSchema` で行い、insert の型付けは drizzle の `$inferInsert` を使う。drizzle-zod は不要。

## マイグレーション / seed

- `pnpm db:generate` … schema の変更から SQL を生成（[drizzle/](drizzle/)）。
- `pnpm db:migrate` … 生成済みマイグレーションを DB に適用。
- `pnpm db:seed` … 開発用サンプルデータを投入（[src/seed.ts](src/seed.ts)）。
- `pnpm db:reset` … スキーマを破棄して migrate → seed まで一括実行（開発用・[scripts/db-reset.sh](../../scripts/db-reset.sh)）。
- 接続情報は `DATABASE_URL` 環境変数から読む（root の各スクリプトは `dotenv` で `.env` を読み込む）。

## 注意

- `dist` は生成物のため git 管理外（[.gitignore](.gitignore)）。消費側の `build` / `typecheck` は turbo の `^build` 依存でこのパッケージの `dist` を先に生成する（[turbo.json](../../turbo.json)）。手動で生成したい場合は `pnpm --filter @pnpm-test-workspace/db build`。
- `drizzle/`（生成されたマイグレーション）は **git 管理する**。スキーマ履歴であり、各環境で同じ順序で適用する必要があるため。
