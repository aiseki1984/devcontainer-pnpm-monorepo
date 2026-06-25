import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBucket, getClient } from "./client.js";

/**
 * アバター画像のオブジェクトキーを組み立てる。
 * `{userId}/{ランダム}.{ext}` 形式。バケット自体が avatars 用なのでキーに
 * バケット名は含めない（含めると path-style URL が /avatars/avatars/... と二重になる）。
 * ユーザーごとに名前空間を分け、アップロードのたびにランダム部を変えることで
 * ブラウザ画像キャッシュを確実に更新する（旧オブジェクトは孤児になるが、
 * アバター 1 枚の boilerplate では掃除は省略）。
 */
export function buildAvatarKey(userId: number, ext: string): string {
  const token = crypto.randomUUID();
  return `${userId}/${token}.${ext}`;
}

/**
 * アバターアップロード用の presigned PUT URL を発行する。
 *
 * presign は **オフラインの署名計算**で、ここから Garage への接続は発生しない。
 * 署名には `contentType` が含まれるため、ブラウザは PUT 時に同じ `Content-Type`
 * ヘッダを送る必要がある＝サーバ側で MIME を強制できる。
 */
export function presignAvatarUpload(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { key, contentType, expiresInSeconds = 60 } = params;
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * アバター表示用の presigned GET URL を発行する（バケットは非公開のため）。
 * 表示のたびに発行され、URL には有効期限がある。
 */
export function presignAvatarDownload(params: {
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { key, expiresInSeconds = 300 } = params;
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  );
}
