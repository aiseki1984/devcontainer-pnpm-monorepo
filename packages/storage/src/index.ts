import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getClient, getInternalClient, getPublicBaseUrl } from "./client.js";

export {
  getPublicBucket,
  getPrivateBucket,
  getPublicBaseUrl,
} from "./client.js";

/**
 * オブジェクトキーを組み立てる。`{prefix}/{userId}/{ランダム}.{ext}` 形式。
 * 用途（avatar / gallery / logos など）を prefix で分け、ユーザーごとに名前空間を切る。
 * アップロードのたびにランダム部を変えることで、固定 URL でもブラウザ画像キャッシュが
 * 確実に更新される（旧オブジェクトは孤児になりうるので、更新側で削除する想定）。
 */
export function buildObjectKey(
  prefix: string,
  userId: number,
  ext: string,
): string {
  const token = crypto.randomUUID();
  return `${prefix}/${userId}/${token}.${ext}`;
}

/**
 * 公開オブジェクトのブラウザ向け URL を組み立てる（署名なしの固定 URL）。
 * 公開バケットは Garage website エンドポイントで匿名配信されるため、ここで返す URL は
 * 認証なしで誰でも取得でき、CDN キャッシュにも向く。
 */
export function publicObjectUrl(key: string): string {
  return `${getPublicBaseUrl()}/${key}`;
}

/** presigned POST の発行結果。クライアントは url へ multipart/form-data を POST する。 */
export interface UploadPost {
  /** POST 先（バケットのエンドポイント）。 */
  url: string;
  /**
   * フォームに含めるフィールド（署名・ポリシー等）。クライアントは FormData に
   * これらを **すべて** 入れ、最後に `file` を append する。
   */
  fields: Record<string, string>;
}

/**
 * アップロード用の presigned POST を発行する（方式 A・サイズ実強制版）。
 *
 * presigned PUT と違い、**署名ポリシーに条件を焼き込める**のが POST の利点:
 * - `content-length-range` で **実バイト数の上限**を強制（PUT では自己申告しか縛れず、
 *   `curl --data-binary @huge.bin` で巨大ファイルを直接送れてしまう）。
 * - `Content-Type` を `eq` 条件で固定（宣言ヘッダの一致を強制）。
 *
 * ただし POST/PUT いずれもバイト**内容**までは見ないため、実体が本当に画像かは
 * 保存前に magic number で別途検証する（{@link readObjectHead}）。
 *
 * 署名はオフライン計算で、ここから Garage への接続は発生しない。公開・非公開どちらの
 * バケットでもアップロードは S3 API(:3900)・presigned で行う（書き込みは常に絞る）。
 */
export function presignUpload(params: {
  bucket: string;
  key: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds?: number;
}): Promise<UploadPost> {
  const { bucket, key, contentType, maxBytes, expiresInSeconds = 60 } = params;
  return createPresignedPost(getClient(), {
    Bucket: bucket,
    Key: key,
    // Content-Type を Fields に入れると createPresignedPost が eq 条件も自動付与する。
    Fields: { "Content-Type": contentType },
    Conditions: [["content-length-range", 1, maxBytes]],
    Expires: expiresInSeconds,
  });
}

/**
 * 非公開オブジェクトの表示用 presigned GET URL を発行する（バケットが非公開のため）。
 * URL には有効期限があり、表示のたびに発行し直す。公開バケットには使わない
 * （公開は {@link publicObjectUrl} の固定 URL）。
 */
export function presignDownload(params: {
  bucket: string;
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { bucket, key, expiresInSeconds = 300 } = params;
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * オブジェクト先頭の数バイトを取得する（magic number 検証用）。
 * Range 取得なので全体はダウンロードしない。オブジェクトが存在しなければ（NoSuchKey 等で）
 * throw する。存在するが本文が空の場合は空の Uint8Array を返す（呼び出し側で内容不正として扱える）。
 */
export async function readObjectHead(params: {
  bucket: string;
  key: string;
  length?: number;
}): Promise<Uint8Array> {
  const { bucket, key, length = 16 } = params;
  const res = await getInternalClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=0-${length - 1}`,
    }),
  );
  if (!res.Body) {
    return new Uint8Array(0);
  }
  // aws-sdk v3 のストリームヘルパー。Node/ブラウザ双方で Uint8Array を返す。
  return res.Body.transformToByteArray();
}

/** オブジェクトを削除する（内容検証失敗の掃除・旧オブジェクトの掃除など）。 */
export async function deleteObject(params: {
  bucket: string;
  key: string;
}): Promise<void> {
  const { bucket, key } = params;
  await getInternalClient().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
}
