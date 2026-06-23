# pnpm devcontainer モノレポ

pnpm workspaces + Turborepo + devcontainer のモノレポ・ボイラープレート。
Next.js（フロント）と Hono（API）、共有パッケージ（Drizzle / 認証 / Zod / 設定）を
1 リポジトリで扱う構成のテンプレートです。

パッケージ名は `@pnpm-test-workspace/*`（root は `pnpm-test-workspace`）にしているので、
利用時は適宜変更してください。

## ディレクトリ構成

```text
apps/
  web/          # Next.js（一般ユーザー向け・port 3000）
  admin/        # Next.js（管理者向け・port 3001）
  api/          # Hono バックエンド（両フロント共通の API・port 8787）

packages/
  validators/       # Zod スキーマ（フロント・バック共有の入力検証）
  auth/             # 認証プリミティブ（argon2 ハッシュ・jose の JWT・リフレッシュトークン）
  db/               # Drizzle ORM + スキーマ + マイグレーション + クエリ
  ui/               # 共通コンポーネント（shadcn/ui ベース）
  tsconfig/         # 共通 tsconfig（base / node / nextjs）
  eslint-config/    # 共通 ESLint 設定（base / next）
```

アーキテクチャやコーディング規約の詳細は [CLAUDE.md](CLAUDE.md) を参照。

## セットアップ（クローン後）

devcontainer で開く前提。`postCreateCommand` が依存関係を用意するので、
最初に環境変数ファイルを作ってから DB を初期化します。

```bash
# 環境変数ファイルを作成して、必要なら値を編集する
cp .env.example .env

# DB を作成 → マイグレーション → シードまで一気に流す
pnpm db:reset

# 開発サーバー起動（web / admin / api をまとめて起動）
pnpm dev
```

個別に実行したい場合:

```bash
pnpm db:migrate   # マイグレーションのみ
pnpm db:seed      # シードのみ（dev 用ユーザー/管理者を投入）
pnpm dev:api      # api だけ起動
pnpm --filter @pnpm-test-workspace/web dev   # 特定のパッケージだけ起動
```

よく使うコマンド: `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test`
（いずれも Turbo 経由でワークスペース全体）。

## 環境変数について

- 実値はリポジトリルートの **`.env`** に置く（`.env` は gitignore 済み。`.env.example` がテンプレート）。
- root の npm scripts（`pnpm dev`, `pnpm build`, `pnpm db:migrate` など）が **dotenv-cli** で `.env` を読み込む。
  そのため変数を足しても **devcontainer のリビルドは不要**で、対象プロセスを再起動すれば反映される。
- Turbo は strict env モードのため、タスクに渡す変数は `turbo.json` の `globalPassThroughEnv` にも登録する。
- API のポートは汎用の `PORT` ではなく **`API_PORT`** を使う（`PORT` は Next.js も読み web と衝突するため）。
- 既に在る環境変数（CI / 本番の実環境変数や vitest の `todo_test`）が常に優先される。
