# Dev Container

この devcontainer は、Next.js、Hono、PostgreSQL、Drizzle Studio、Playwright を使うフルスタック TypeScript 開発用の環境です。

## ベースイメージ

アプリ用コンテナは `.devcontainer/Dockerfile` 経由で `mcr.microsoft.com/devcontainers/base:ubuntu` を使います。

素の Ubuntu ではなく devcontainer 用の Ubuntu を使う理由は、VS Code Dev Containers で使いやすいように `vscode` ユーザーや sudo などが最初から整っているためです。Node.js や pnpm のようなプロジェクト向けツールは Dockerfile に直接書かず、Dev Container Features で追加しています。

## 含まれているもの

- Ubuntu ベースの devcontainer 環境
- Dev Container Features による Node.js LTS と pnpm
- Dev Container Features による GitHub CLI
- Dev Container Feature による Claude Code
- PostgreSQL 17 サービス
- アプリコンテナ内の `psql` クライアント
- Playwright で Chromium を動かすための OS 依存ライブラリ
- pnpm store の永続化 volume
- Claude Code 設定の永続化 volume
- Codex 設定と認証情報の永続化 volume
- VS Code 拡張機能と SQLTools の接続設定

## サービス構成

`compose.yml` では、次の2つのサービスを定義しています。

- `app`: メインの開発用コンテナ
- `postgres`: ローカル開発用 PostgreSQL

アプリコンテナから PostgreSQL へは、リポジトリルートの `.env` にある次の URL で接続します。

```text
postgres://dev:dev@postgres:5432/todo_dev
```

PostgreSQL 側の設定は次の通りです。

```text
POSTGRES_USER=dev
POSTGRES_PASSWORD=dev
POSTGRES_DB=todo_dev
```

## ポート

ブラウザや開発ツールからアクセスしやすいように、次のポートを転送します。

| ポート | 用途                                |
| ------ | ----------------------------------- |
| 3000   | Next.js Web                         |
| 3001   | Next.js Admin                       |
| 8787   | Hono API / ローカル worker サーバー |
| 5432   | PostgreSQL                          |
| 4983   | Drizzle Studio                      |

PostgreSQL は Docker Compose 側でも `5432:5432` として公開しています。そのため、必要であればホスト側の DB クライアントからも接続できます。

## Playwright

Dockerfile では、Playwright の Chromium を動かすために必要な OS ライブラリを入れています。

Playwright 本体は、アプリ作成後にプロジェクトの devDependencies として追加します。

```bash
pnpm add -D @playwright/test
```

コンテナ作成時の `postCreateCommand` では、`package.json` が存在する場合に `pnpm install` を実行します。Playwright がインストール済みであれば、続けて Chromium もインストールします。`.env` は自動生成せず、必要な場合は `cp .env.example .env` で明示的に作成します。

```bash
pnpm exec playwright install chromium
```

このように、OS 依存ライブラリは Docker イメージ側、Playwright 本体とブラウザバイナリはプロジェクト側、という分担にしています。

## postCreateCommand

コンテナ作成後には、`postCreateCommand` で初期セットアップを行います。

この処理は、devcontainer の初回作成や rebuild 後に、開発に必要な設定と依存関係を自動で整えるためのものです。

現在のコマンドは次の通りです。

```bash
sudo chown -R vscode:vscode /home/vscode/.claude /home/vscode/.codex /home/vscode/.local/share/pnpm && { if [ ! -f .env ]; then echo '[postCreate] .env is missing. Run: cp .env.example .env'; fi; if [ -f package.json ]; then pnpm config set store-dir /home/vscode/.local/share/pnpm/store --location=user && pnpm install && if pnpm exec playwright --version >/dev/null 2>&1; then pnpm exec playwright install chromium; fi; fi; }
```

処理内容は次の通りです。

1. `/home/vscode/.claude`、`/home/vscode/.codex`、`/home/vscode/.local/share/pnpm` の所有者を `vscode` に変更します。
   named volume は初期状態で root 所有になることがあるため、Claude Code、Codex、pnpm が設定やキャッシュを書き込めるようにしています。

2. `.env` が存在しない場合は、自動生成せずに作成コマンドだけを表示します。

   ```bash
   cp .env.example .env
   ```

3. `package.json` が存在する場合だけ、pnpm の store 先を設定します。

   ```bash
   pnpm config set store-dir /home/vscode/.local/share/pnpm/store --location=user
   ```

   これにより、pnpm の package store は `compose.yml` で定義している `pnpm_store` volume に保存されます。rebuild 後も package store が残るため、依存関係の再インストールが速くなります。

4. `package.json` が存在する場合だけ `pnpm install` を実行します。
   まだプロジェクト作成前でも devcontainer の作成に失敗しないようにするためです。

5. Playwright がインストール済みの場合だけ Chromium をインストールします。
   `@playwright/test` を追加する前でも devcontainer の作成に失敗しないようにしています。

この分担により、OS 依存ライブラリは Docker イメージ側、Node.js パッケージと pnpm store はプロジェクト・volume 側、Playwright のブラウザバイナリは必要になったタイミングで追加、という構成にしています。

## 永続化 volume

devcontainer の rebuild 後も残したいデータは、named volume に保存しています。

- `postgres_data`: PostgreSQL のデータ
- `pnpm_store`: pnpm のパッケージ store
- `claude-code-config`: Claude Code の設定と認証情報
- `codex-config`: Codex の設定、認証情報、ローカル状態

## Rebuild が必要なとき

次のファイルを変更した場合は、VS Code のコマンドパレットから rebuild します。

```text
Dev Containers: Rebuild Container
```

対象ファイル:

- `.devcontainer/Dockerfile`
- `.devcontainer/compose.yml`
- `.devcontainer/devcontainer.json`
