# pnpm devcontainer モノレポ

とりあえずパッケージの名前は `pnpm-test-workspace` にしているので、適宜変更する。

## セットアップ（クローン後）

devcontainer で開く前提。`postCreateCommand` が依存関係を用意するので、
最初に環境変数ファイルを作ってから DB を初期化する。

```bash
# 環境変数ファイルを作成して、必要なら値を編集する
cp .env.example .env

# DB を作成 → マイグレーション → シードまで一気に流す
pnpm db:reset

# 開発サーバー起動
pnpm dev
```

個別に実行したい場合:

```bash
pnpm db:migrate   # マイグレーションのみ
pnpm db:seed      # シードのみ
```

### 環境変数について

- 実値はリポジトリルートの **`.env`** に置く（`.env` は gitignore 済み。`.env.example` がテンプレート）。
- root の npm scripts（`pnpm dev`, `pnpm build`, `pnpm db:migrate` など）が **dotenv-cli** で `.env` を読み込む。
  そのため変数を足しても **devcontainer のリビルドは不要**で、対象プロセスを再起動すれば反映される。
- 各 package の `env.ts` は `process.env` の検証だけを行い、`.env` の読み込みはしない。
- 既に在る環境変数（CI/本番の実環境変数や vitest の `todo_test`）が常に優先される。

## モノレポ構成

```
apps/
  web/          # Next.js
  api/          # Hono.js バックエンド

packages/
  tsconfig/         # tsconfig 共通設定（独立パッケージ @pnpm-test-workspace/tsconfig）
    base.json       # 全パッケージ共通ベース
    node.json       # Node.js（Hono / ライブラリ）向け
    nextjs.json     # Next.js向け
  eslint-config/    # ESLint 共通設定（独立パッケージ @pnpm-test-workspace/eslint-config）
    base.mjs        # Node / ライブラリ系（api・validators 等）向け
    next.mjs        # Next.js向け（base を拡張）
  db/           # Drizzle ORM + スキーマ定義 + マイグレーション
  ui/           # 共通コンポーネント（shadcn/ui ベース）
  auth/         # 認証ロジック（JWT・リフレッシュトークン）
  validators/   # Zod スキーマ（フロント・バック共有）
```

## 手順

- devcontainer の作成/起動
- ルートのpackage.jsonを作成 ( pnpm init )
- pnpm workspace を定義
  - pnpm-workspace.yaml
- Turborepo
  - ついでに typescript, prettier も
  - `pnpm add -Dw turbo typescript prettier`
- apps/web を nextjs で作成
- apps/api を honojs で作成

## 空ディレクトリ

```bash
mkdir -p apps/web apps/api
mkdir -p packages/db packages/ui packages/auth packages/validators
```

## nextjs

```bash
pnpm create next-app apps/web

[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: sharp@0.34.5, unrs-resolver@1.12.2
```

作成後、`apps/web/package.json` の `name` は workspace 内で分かりやすい名前にします。

```json
{
  "name": "@pnpm-test-workspace/web"
}
```

さらに、pnpm-workspace.yamlは削除する。

```bash
rm apps/web/pnpm-workspace.yaml
rm apps/web/pnpm-lock.yaml
```

そのあと、先ほどの ERR_PNPM_IGNORED_BUILDS を解消する

```bash
pnpm approve-builds
```

動作確認
ルートから web だけを起動する場合は、filter を使います。

```bash
pnpm --filter @pnpm-test-workspace/web dev
```

## hono

```bash
pnpm create hono apps/api
✔ Which template do you want to use? nodejs
```

同様に作成後、`apps/api/package.json` の `name` は次のようにします。

```json
{
  "name": "@pnpm-test-workspace/api"
}
```
