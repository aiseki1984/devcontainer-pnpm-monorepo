import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3 互換ストレージ（Garage）への接続情報を env から組み立てる。
 * このパッケージは aws-sdk を隠蔽する境界なので、S3Client を直接外へ出さない
 * （`db` が drizzle を隠すのと同じ発想）。consumer は presign helper だけを使う。
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function buildClient(endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: requireEnv("S3_REGION"),
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY"),
      secretAccessKey: requireEnv("S3_SECRET_KEY"),
    },
    // Garage / MinIO などの S3 互換は vhost 形式を取らないので path-style 必須。
    forcePathStyle: true,
    // aws-sdk v3.700+ は既定でリクエストに CRC32 チェックサムを付ける。これが
    // presigned PUT URL に x-amz-checksum-crc32（空ボディ前提の値）として署名ごと
    // 焼き込まれ、ブラウザが実バイトを送ると Garage 側の計算値と一致せず 400 になる。
    // S3 互換ストレージでは既定チェックサムを切る（必要時のみに落とす）。
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

let presignClient: S3Client | null = null;
let internalClient: S3Client | null = null;

/**
 * **presigned URL 発行用**のクライアント（遅延生成シングルトン）。
 * presigned URL の署名にはエンドポイントの host が焼き込まれ、その URL を**ブラウザ**が
 * 直接叩くため、host はブラウザのアクセス先（`S3_ENDPOINT`＝例 `localhost:3900`）でなければ
 * ならない。import しただけでは env を要求しないので、helper を呼ばないプロセス（ビルド等）
 * が env 未設定でも落ちない。
 */
export function getClient(): S3Client {
  if (!presignClient) {
    presignClient = buildClient(requireEnv("S3_ENDPOINT"));
  }
  return presignClient;
}

/**
 * **サーバ → ストレージの直接操作用**クライアント（GetObject / DeleteObject 等）。
 * presigned URL と違い API プロセス自身が接続するため、**API から到達できる**内部
 * エンドポイント（`S3_INTERNAL_ENDPOINT`＝例 `http://garage:3900`）を使う。devcontainer では
 * API コンテナから `localhost:3900` には届かない（あれはブラウザ用 host）ため両者を分ける。
 * 未設定なら `S3_ENDPOINT` にフォールバック（単一ホストで両者が同じ本番など）。
 */
export function getInternalClient(): S3Client {
  if (!internalClient) {
    const endpoint =
      process.env.S3_INTERNAL_ENDPOINT ?? requireEnv("S3_ENDPOINT");
    internalClient = buildClient(endpoint);
  }
  return internalClient;
}

/** 操作対象のバケット名。 */
export function getBucket(): string {
  return requireEnv("S3_BUCKET");
}
