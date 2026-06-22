#!/usr/bin/env bash
# 開発用: DB を完全リセットしてマイグレーションを最初から再適用する。
#
# public スキーマの全テーブルと、drizzle のマイグレーション履歴
# (drizzle.__drizzle_migrations) をまとめて破棄する。
# データは全消去されるので **本番では絶対に使わない**。
#
# 使い方: pnpm db:reset   （または bash scripts/db-reset.sh）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# リポジトリルートの .env から DATABASE_URL を読み込む。
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[db-reset] DATABASE_URL が未設定です (.env を確認してください)" >&2
  exit 1
fi

echo "[db-reset] dropping schemas (drizzle, public) ..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

echo "[db-reset] applying migrations ..."
pnpm --filter @pnpm-test-workspace/db db:migrate

echo "[db-reset] seeding sample data ..."
pnpm --filter @pnpm-test-workspace/db db:seed

echo "[db-reset] done."
