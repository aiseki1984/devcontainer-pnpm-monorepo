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

画像は S3 互換ストレージ **Garage** に保管する。`.devcontainer/compose.yml`
の `garage` サービスとして起動するので、サービス追加後は **devcontainer を一度リビルド**
してコンテナを作る。

バケットは **公開/非公開の2系統**:

- **`media-public`**（匿名 read。avatar / logo）— 読み取りは Garage の **website エンドポイント**
  (`:3902`) 経由で署名なしの固定 URL（`http://media-public.web.localhost:3902/<key>`）。
- **`media-private`**（presigned でしか読めない。gallery 等）— ギャラリー機能で追加予定。

layout・公開バケット・アクセスキーは `garage server --single-node --default-bucket` と
compose の `GARAGE_DEFAULT_*` で **起動時に自動作成**される（`GARAGE_DEFAULT_BUCKET=media-public`）。
固定の dev キーは `.env.example` の `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_PUBLIC_BUCKET` と一致済み。
残る手動作業は **(1) 公開バケットの匿名公開（website）** と **(2) CORS** の2つ。

> 既に古い方式（手動 layout/bucket/key、または旧 `avatars` バケット）で初期化済みのボリュームが
> 残っている場合は一度クリーンにする: `docker volume rm <project>_garage_meta <project>_garage_data`
> （`<project>` は `docker volume ls` で確認。削除後にコンテナを再作成すると自動初期化が走る）。

2つとも S3 API（`PutBucketWebsite` / `PutBucketCors`）で設定でき、**aws-cli に統一**できる。
**認証情報はどちらも compose の `GARAGE_DEFAULT_*` と同じ固定 dev キー**で、まず共通の env を export:

```bash
export AWS_ACCESS_KEY_ID=GK0123456789abcdef01234567
export AWS_SECRET_ACCESS_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
# (1) website: media-public を匿名 read 可能にする（S3 API では匿名 GET 不可なので website 経由で配信）。
export WEBSITE='{"IndexDocument":{"Suffix":"index.html"}}'
# (2) CORS: ブラウザの presigned POST 直アップロード用（公開 read は website 経由＝CORS 不要）。
export CORS='{"CORSRules":[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["GET","POST"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"]}]}'
```

**(A) devcontainer の中から aws-cli で**（推奨）。aws-cli は Features 導入済み。devcontainer は
garage と同じ Docker ネットワークにいるのでサービス名 `garage:3900` へ直接届く
（コンテナ内から `localhost:3900` では届かない点に注意）。

```bash
aws --endpoint-url http://garage:3900 --region garage \
  s3api put-bucket-website --bucket media-public --website-configuration "$WEBSITE"
aws --endpoint-url http://garage:3900 --region garage \
  s3api put-bucket-cors --bucket media-public --cors-configuration "$CORS"
```

**(B) ホスト側から docker で**（devcontainer に入らず、ホストに aws-cli が無くても可）。使い捨ての
`amazon/aws-cli` コンテナを garage と同じネットワークに繋いで実行する。

```bash
GARAGE=$(docker ps -qf name=garage)
GARAGE_NET=$(docker inspect -f \
  '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$GARAGE")
RUN() { docker run --rm --network "$GARAGE_NET" \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  amazon/aws-cli --endpoint-url http://garage:3900 --region garage "$@"; }

RUN s3api put-bucket-website --bucket media-public --website-configuration "$WEBSITE"
RUN s3api put-bucket-cors --bucket media-public --cors-configuration "$CORS"
```

確認: `aws ... s3api get-bucket-website --bucket media-public`、または
`docker exec "$GARAGE" /garage bucket info media-public`（`Website access: true` を確認）。
これで `http://media-public.web.localhost:3902/<key>` が匿名で読める（`*.localhost` は主要ブラウザが
127.0.0.1 に解決するので hosts 編集は不要）。

> garage CLI でも同じことができる（`docker exec "$GARAGE" /garage bucket website --allow media-public`）。
> aws-cli 版は S3 標準 API なので CORS と手順が揃い、実 S3 にも通じる。

### (3) 非公開バケット media-private（マイギャラリー用）

ギャラリーは **非公開バケット `media-private`** に保存し、表示は presigned GET（匿名 read は付けない）。
こちらは `--default-bucket` の自動作成対象ではないので、**バケット作成 + dev キーへの権限付与**を一度行う。
バケット作成と権限付与は garage CLI が確実（distroless だがバイナリ `/garage` は exec できる）:

```bash
GARAGE=$(docker ps -qf name=garage)
docker exec "$GARAGE" /garage bucket create media-private
# RW だけでなく Owner も付ける。PutBucketCors 等のバケット設定操作は Owner 権限が要る
# （RW はオブジェクト操作のみ）。media-public は --default-bucket で RWO 付きで作られる。
docker exec "$GARAGE" /garage bucket allow --read --write --owner \
  media-private --key GK0123456789abcdef01234567
```

アップロードはブラウザの presigned POST 直送なので、media-private にも **CORS** が要る（read は
presigned GET＝`<img>` には CORS 不要だが、POST のため）。`$CORS` は (2) で export 済みのものを使う:

```bash
# (A) devcontainer 内
aws --endpoint-url http://garage:3900 --region garage \
  s3api put-bucket-cors --bucket media-private --cors-configuration "$CORS"
# (B) ホスト側 docker の場合は (2) の RUN 関数で:
#   RUN s3api put-bucket-cors --bucket media-private --cors-configuration "$CORS"
```

> media-private には website を **付けない**（匿名公開しない）。確認は
> `docker exec "$GARAGE" /garage bucket info media-private`（`Website access: false`／キーに RWO があること）。

> 補足: presigned URL は **オフラインの署名計算**で、API コンテナから Garage への到達性は不要。
> 署名に埋まる host（`S3_ENDPOINT` の `localhost:3900`）とブラウザのアクセス先が一致することが重要。
> このため `S3_ENDPOINT` はコンテナ内向けの `garage:3900` ではなく **`localhost:3900`** にする。
> （aws-cli が `garage:3900` を使うのは別問題で、そちらは「指定 endpoint で署名 → そこへ接続」のため
> 署名 host と接続 host が常に一致する。）

## 環境変数について

- 実値はリポジトリルートの **`.env`** に置く（`.env` は gitignore 済み。`.env.example` がテンプレート）。
- root の npm scripts（`pnpm dev`, `pnpm build`, `pnpm db:migrate` など）が **dotenv-cli** で `.env` を読み込む。
  そのため変数を足しても **devcontainer のリビルドは不要**で、対象プロセスを再起動すれば反映される。
- Turbo は strict env モードのため、タスクに渡す変数は `turbo.json` の `globalPassThroughEnv` にも登録する。
- API のポートは汎用の `PORT` ではなく **`API_PORT`** を使う（`PORT` は Next.js も読み web と衝突するため）。
- 既に在る環境変数（CI / 本番の実環境変数や vitest の `todo_test`）が常に優先される。
