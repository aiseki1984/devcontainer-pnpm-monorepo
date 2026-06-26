import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBucket, getClient, getInternalClient } from "./client.js";

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

/** presigned POST の発行結果。クライアントは url へ multipart/form-data を POST する。 */
export interface AvatarUploadPost {
  /** POST 先（バケットのエンドポイント）。 */
  url: string;
  /**
   * フォームに含めるフィールド（署名・ポリシー等）。クライアントは FormData に
   * これらを **すべて** 入れ、最後に `file` を append する。
   */
  fields: Record<string, string>;
}

/**
 * アバターアップロード用の presigned POST を発行する（方式 A・サイズ実強制版）。
 *
 * presigned PUT と違い、**署名ポリシーに条件を焼き込める**のが POST の利点:
 * - `content-length-range` で **実バイト数の上限**を強制（PUT では自己申告しか縛れず、
 *   `curl --data-binary @huge.bin` で巨大ファイルを直接送れてしまった）。
 * - `Content-Type` を `eq` 条件で固定（宣言ヘッダの一致を強制）。
 *
 * ただし POST/PUT いずれもバイト**内容**までは見ないため、実体が本当に画像かは
 * 保存前に magic number で別途検証する（{@link readAvatarHead}）。
 *
 * 署名はオフライン計算で、ここから Garage への接続は発生しない。
 */
export function presignAvatarUpload(params: {
  key: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds?: number;
}): Promise<AvatarUploadPost> {
  const { key, contentType, maxBytes, expiresInSeconds = 60 } = params;
  return createPresignedPost(getClient(), {
    Bucket: getBucket(),
    Key: key,
    // Content-Type を Fields に入れると createPresignedPost が eq 条件も自動付与する。
    Fields: { "Content-Type": contentType },
    Conditions: [["content-length-range", 1, maxBytes]],
    Expires: expiresInSeconds,
  });
}

/**
 * オブジェクト先頭の数バイトを取得する（magic number 検証用）。
 * Range 取得なので全体はダウンロードしない。オブジェクトが存在しなければ throw する。
 */
export async function readAvatarHead(
  key: string,
  length = 16,
): Promise<Uint8Array> {
  const res = await getInternalClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
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

/** アバターオブジェクトを削除する（内容検証に失敗した不正オブジェクトの掃除など）。 */
export async function deleteAvatarObject(key: string): Promise<void> {
  await getInternalClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
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
