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

### フロントの実装パターン（あえて2通り見せています）

参考用に、同じ関心事をあえて別方式で実装している箇所があります。どちらが正解という
ものではなく、プロジェクトに合わせて寄せて使ってください。

- **認証状態の保持**: web は React Context + `useState`（追加ライブラリ不要）、
  admin は **zustand** ストア（`apps/admin/src/lib/auth-store.ts`）。どちらも `useAuth()`
  の外形は同じ。トークンは両方とも HttpOnly Cookie のままで、保持するのは表示用の
  プロフィールだけ。
- **フォーム**: `react-hook-form` + `@hookform/resolvers` で、入力検証は
  `packages/validators` の Zod スキーマを resolver に共有（フロント／バック単一ソース）。
- **mutation**: フォームは RHF、セッション失効ボタンは React 標準の `useActionState`
  （`apps/admin/src/components/session-actions.tsx`）。読み取りは当面 SSR + fetch で、
  TanStack Query は未導入。

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

## オブジェクトストレージ（Garage）の初期化

プロフィール画像は S3 互換ストレージ **Garage** に保管する。`.devcontainer/compose.yml`
の `garage` サービスとして起動するので、サービス追加後は **devcontainer を一度リビルド**
してコンテナを作る。Garage はクラスタ layout・バケット・アクセスキー・CORS の初期化が
**1 回だけ** 必要（データは volume に永続化されるので以降は不要）。

初期化は**ホスト側のシェル**（Docker が動いているマシン）から実行する。この devcontainer は
固定のプロジェクト名で起動するため `docker compose` ではサービスを掴めないことがある。
そこで `docker` でコンテナを名前フィルタで掴んでから操作する（公式イメージは distroless
なのでバイナリ `/garage` を `docker exec` で直接叩く）。

```bash
# garage コンテナ ID を変数に取る（以降のコマンドで使い回す）
GARAGE=$(docker ps -qf name=garage)

# 1) ノード ID を確認（HEALTHY と表示され、先頭列の ID をコピー）
docker exec "$GARAGE" /garage status
# 379e2eff4e64af8c

# 2) 単一ノードに容量を割り当てて layout を確定（<NODE_ID> は上で得た ID）
docker exec "$GARAGE" /garage layout assign -z dc1 -c 1G <NODE_ID>
docker exec "$GARAGE" /garage layout apply --version 1

# 3) バケットとアクセスキーを作成（.env の S3_BUCKET=avatars に合わせる）
docker exec "$GARAGE" /garage bucket create avatars
docker exec "$GARAGE" /garage key create web-app
#   → 出力された "Key ID" と "Secret key" を .env の
#     S3_ACCESS_KEY / S3_SECRET_KEY に貼り付ける

# 4) キーにバケットの読み書き＋所有権（CORS 設定に必要）を付与
docker exec "$GARAGE" /garage bucket allow --read --write --owner avatars --key web-app
```

最後に **CORS** を設定する。ブラウザが presigned PUT/GET で Garage を直接叩くため、
web の origin からの `PUT`/`GET` を許可し、アップロード完了確認用に `ETag` を公開する。
CORS の設定は S3 API（`PutBucketCors`）経由で、ローカルに aws CLI が無くても済むよう
`amazon/aws-cli` イメージを **garage と同じ Docker ネットワーク**に繋いで実行する
（エンドポイントはネットワーク内のサービス名 `garage:3900`）。

```bash
# garage が属するネットワーク名を取得
GARAGE_NET=$(docker inspect -f \
  '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$GARAGE")

CORS='{"CORSRules":[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["GET","PUT"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"]}]}'

docker run --rm --network "$GARAGE_NET" \
  -e AWS_ACCESS_KEY_ID=<Key ID> \
  -e AWS_SECRET_ACCESS_KEY=<Secret key> \
  amazon/aws-cli --endpoint-url http://garage:3900 --region garage \
  s3api put-bucket-cors --bucket avatars --cors-configuration "$CORS"

```

> 補足: presigned URL は **オフラインの署名計算**で、API コンテナから Garage への到達性は不要。
> 署名に埋まる host（`S3_ENDPOINT` の `localhost:3900`）とブラウザのアクセス先が一致することが重要。
> このため `S3_ENDPOINT` はコンテナ内向けの `garage:3900` ではなく **`localhost:3900`** にする。
> （CORS 設定の aws-cli が `garage:3900` を使うのは別問題で、そちらは署名さえ整合すれば host は何でもよい。）
> CI など完全に再現可能なキーが要る場合は `key create` の代わりに
> `docker exec "$GARAGE" /garage key import --yes <ACCESS_KEY_ID> <SECRET_KEY>` で固定キーを投入してもよい。

## 環境変数について

- 実値はリポジトリルートの **`.env`** に置く（`.env` は gitignore 済み。`.env.example` がテンプレート）。
- root の npm scripts（`pnpm dev`, `pnpm build`, `pnpm db:migrate` など）が **dotenv-cli** で `.env` を読み込む。
  そのため変数を足しても **devcontainer のリビルドは不要**で、対象プロセスを再起動すれば反映される。
- Turbo は strict env モードのため、タスクに渡す変数は `turbo.json` の `globalPassThroughEnv` にも登録する。
- API のポートは汎用の `PORT` ではなく **`API_PORT`** を使う（`PORT` は Next.js も読み web と衝突するため）。
- 既に在る環境変数（CI / 本番の実環境変数や vitest の `todo_test`）が常に優先される。
