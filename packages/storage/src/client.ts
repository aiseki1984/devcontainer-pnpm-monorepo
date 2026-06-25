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

let client: S3Client | null = null;

/**
 * S3Client は遅延生成のシングルトン。import しただけで env を要求しないので、
 * storage helper を呼ばないプロセス（ビルド等）が env 未設定でも落ちない。
 */
export function getClient(): S3Client {
  if (client) {
    return client;
  }
  client = new S3Client({
    endpoint: requireEnv("S3_ENDPOINT"),
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
  return client;
}

/** 操作対象のバケット名。 */
export function getBucket(): string {
  return requireEnv("S3_BUCKET");
}
