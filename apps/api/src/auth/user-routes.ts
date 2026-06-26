import { Hono } from "hono";
import {
  AVATAR_MAX_BYTES,
  avatarPresignSchema,
  GALLERY_MAX_BYTES,
  galleryPresignSchema,
  gallerySaveSchema,
  imageExtForMime,
  registerSchema,
  sniffImageMime,
  updateMeSchema,
} from "@pnpm-test-workspace/validators";
import {
  createGalleryImage,
  createUser,
  createUserRefreshToken,
  deleteGalleryImage,
  findUserRefreshTokenByHash,
  getUserByEmail,
  getUserById,
  listGalleryImagesByUser,
  revokeAllUserRefreshTokens,
  revokeUserRefreshToken,
  updateUserAvatar,
} from "@pnpm-test-workspace/db";
import {
  buildObjectKey,
  deleteObject,
  getPrivateBucket,
  getPublicBucket,
  presignDownload,
  presignUpload,
  readObjectHead,
} from "@pnpm-test-workspace/storage";
import { hashPassword } from "@pnpm-test-workspace/auth";
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAccessCookie,
  setRefreshCookie,
} from "./cookies.js";
import { requireAuth } from "./middleware.js";
import { createAuthRoutes } from "./route-factory.js";

/** 一般ユーザー向け認証ルート（/auth/* と /me）。 */
export const userAuthRoutes = new Hono();

const userAuth = createAuthRoutes({
  role: "user",
  loginPath: "/auth/login",
  logoutPath: "/auth/logout",
  refreshPath: "/auth/refresh",
  mePath: "/me",
  refreshCookie: REFRESH_COOKIE,
  getByEmail: getUserByEmail,
  getById: getUserById,
  createRefreshToken: ({ accountId, tokenHash, expiresAt }) =>
    createUserRefreshToken({ userId: accountId, tokenHash, expiresAt }),
  findRefreshTokenByHash: findUserRefreshTokenByHash,
  getRefreshAccountId: (row) => row.userId,
  revokeRefreshToken: revokeUserRefreshToken,
  revokeAllRefreshTokens: revokeAllUserRefreshTokens,
  setAccessCookie,
  setRefreshCookie,
  clearCookies: clearAuthCookies,
  requireRole: requireAuth,
});

userAuthRoutes.post("/auth/register", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid JSON" }, 400);
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      400,
    );
  }
  if (await getUserByEmail(parsed.data.email)) {
    return c.json({ ok: false, error: "email already registered" }, 409);
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
  });
  await userAuth.issueSession(c, user);
  return c.json({ ok: true, user: userAuth.publicAccount(user) }, 201);
});

/**
 * アバターアップロード用の presigned POST を発行する。
 * クライアントは MIME / サイズを申告し、検証を通れば直接 Garage へ multipart POST できる
 * URL とフォームフィールド、保存予定のオブジェクトキーを受け取る。実バイトは API を
 * 経由しない（方式 A）。サイズ上限は POST ポリシーの content-length-range が実強制する。
 * avatar は公開アセットなので公開バケットに置く（読み取りは公開固定 URL）。
 */
userAuthRoutes.post("/me/avatar/presign", requireAuth, async (c) => {
  const userId = Number(c.get("user").sub);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid JSON" }, 400);
  }
  const parsed = avatarPresignSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      400,
    );
  }
  const ext = imageExtForMime(parsed.data.contentType);
  const key = buildObjectKey("avatars", userId, ext);
  const { url, fields } = await presignUpload({
    bucket: getPublicBucket(),
    key,
    contentType: parsed.data.contentType,
    maxBytes: AVATAR_MAX_BYTES,
  });
  return c.json({ ok: true, url, fields, key });
});

/**
 * アップロード完了後にアバターのオブジェクトキーを保存する。
 * クライアントが渡すキーは自分の名前空間（{自分の id}/）配下かつ presign が発行する
 * 形（{id}/{uuid}.{ext}）に限定し、他ユーザーのキー詐称や任意キーの保存を防ぐ。
 */
userAuthRoutes.patch("/me", requireAuth, async (c) => {
  const userId = Number(c.get("user").sub);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid JSON" }, 400);
  }
  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      400,
    );
  }
  // presign が発行する形（avatars/{userId}/{uuid}.{ext}）だけを受け付ける。プレフィックス
  // 一致だけだと拡張子なしや任意サフィックスも通ってしまうため、キー全体を検証する。
  // userId は数値なので正規表現へ埋めても安全。
  const avatarKeyPattern = new RegExp(
    `^avatars/${userId}/[0-9a-f-]+\\.(jpg|png|webp)$`,
  );
  const keyMatch = avatarKeyPattern.exec(parsed.data.avatarKey);
  if (!keyMatch) {
    return c.json({ ok: false, error: "invalid avatar key" }, 400);
  }
  const key = parsed.data.avatarKey;
  const keyExt = keyMatch[1];
  const bucket = getPublicBucket();

  // 更新前の avatar キーを控えておき、保存成功後に旧オブジェクトを掃除する（孤児防止）。
  const current = await getUserById(userId);
  if (!current) {
    return c.json({ ok: false, error: "user not found" }, 404);
  }
  const previousKey = current.avatarKey;

  // 内容（magic number）検証。presigned POST は宣言 Content-Type しか縛れず中身は見ない
  // ため、保存前に実バイト先頭を読んで実体が JPEG/PNG/WebP か、かつキー拡張子と一致するか
  // を確認する。不一致なら不正オブジェクトを掃除して 400（key 自体は自分の名前空間内なので削除可）。
  let head: Uint8Array;
  try {
    head = await readObjectHead({ bucket, key });
  } catch {
    // オブジェクトが存在しない（アップロード未完了など）。
    return c.json({ ok: false, error: "avatar object not found" }, 400);
  }
  const sniffed = sniffImageMime(head);
  if (!sniffed || imageExtForMime(sniffed) !== keyExt) {
    // 掃除はベストエフォート。削除が失敗してもオブジェクトが孤児として残るだけなので、
    // 本来返すべき検証エラー(400)を握りつぶして 500 に化けさせない。
    try {
      await deleteObject({ bucket, key });
    } catch {
      // 孤児は許容。
    }
    return c.json({ ok: false, error: "invalid avatar content" }, 400);
  }

  const updated = await updateUserAvatar(userId, parsed.data.avatarKey);
  if (!updated) {
    return c.json({ ok: false, error: "user not found" }, 404);
  }

  // 旧 avatar オブジェクトを掃除（ベストエフォート）。新キーは毎回ランダムなので別物。
  if (previousKey && previousKey !== key) {
    try {
      await deleteObject({ bucket, key: previousKey });
    } catch {
      // 孤児は許容（保存自体は成功しているので失敗させない）。
    }
  }
  // 公開形の整形は route-factory の publicAccount に集約（/me・login と同じ形）。
  // avatar は公開バケット配信なので publicAccount が avatarUrl（公開固定 URL）も返す。
  // 専用の GET /me/avatar（旧: presigned GET）は不要になったので廃止。
  return c.json({ ok: true, user: userAuth.publicAccount(updated) });
});

/**
 * マイギャラリー（非公開）。1 ユーザーが複数の私的画像を持つ。avatar（公開）と違い、
 * 表示は非公開バケットの presigned GET URL を都度発行する。すべて requireAuth + 本人スコープ。
 */

/** アップロード用 presigned POST を発行する（非公開バケット）。 */
userAuthRoutes.post("/me/gallery/presign", requireAuth, async (c) => {
  const userId = Number(c.get("user").sub);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid JSON" }, 400);
  }
  const parsed = galleryPresignSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      400,
    );
  }
  const ext = imageExtForMime(parsed.data.contentType);
  const key = buildObjectKey("gallery", userId, ext);
  const { url, fields } = await presignUpload({
    bucket: getPrivateBucket(),
    key,
    contentType: parsed.data.contentType,
    maxBytes: GALLERY_MAX_BYTES,
  });
  return c.json({ ok: true, url, fields, key });
});

/**
 * アップロード完了後にメタを保存する。キーは自分の名前空間（gallery/{自分の id}/）配下の
 * presign 発行形に限定し、内容を magic number 検証してから DB 行を作る。
 */
userAuthRoutes.post("/me/gallery", requireAuth, async (c) => {
  const userId = Number(c.get("user").sub);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid JSON" }, 400);
  }
  const parsed = gallerySaveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      400,
    );
  }
  const bucket = getPrivateBucket();
  // presign が発行する形（gallery/{userId}/{uuid}.{ext}）だけを受け付ける。
  const keyPattern = new RegExp(
    `^gallery/${userId}/[0-9a-f-]+\\.(jpg|png|webp)$`,
  );
  const keyMatch = keyPattern.exec(parsed.data.objectKey);
  if (!keyMatch) {
    return c.json({ ok: false, error: "invalid object key" }, 400);
  }
  const key = parsed.data.objectKey;
  const keyExt = keyMatch[1];

  // 内容（magic number）検証。不一致なら不正オブジェクトを掃除して 400。
  let head: Uint8Array;
  try {
    head = await readObjectHead({ bucket, key });
  } catch {
    return c.json({ ok: false, error: "object not found" }, 400);
  }
  const sniffed = sniffImageMime(head);
  if (!sniffed || imageExtForMime(sniffed) !== keyExt) {
    try {
      await deleteObject({ bucket, key });
    } catch {
      // 孤児は許容。
    }
    return c.json({ ok: false, error: "invalid image content" }, 400);
  }

  const { objectKey, ...rest } = await createGalleryImage({
    userId,
    objectKey: key,
    contentType: parsed.data.contentType,
    sizeBytes: parsed.data.size,
    originalName: parsed.data.originalName ?? null,
  });
  const url = await presignDownload({ bucket, key: objectKey });
  return c.json({ ok: true, image: { ...rest, url } }, 201);
});

/** 自分のギャラリー一覧。各オブジェクトの presigned GET URL を一括発行して返す。 */
userAuthRoutes.get("/me/gallery", requireAuth, async (c) => {
  const userId = Number(c.get("user").sub);
  const bucket = getPrivateBucket();
  const rows = await listGalleryImagesByUser(userId);
  // objectKey は内部キーなので公開形に出さず、presigned URL に変換して返す。
  const images = await Promise.all(
    rows.map(async ({ objectKey, ...rest }) => ({
      ...rest,
      url: await presignDownload({ bucket, key: objectKey }),
    })),
  );
  return c.json({ ok: true, images });
});

/**
 * 自分のギャラリー画像を 1 件削除する。所有権は DB 側の id + user_id 条件で担保し、
 * 他人の id を指定しても 404（存在も漏らさない）。DB 行を消してからオブジェクトを掃除する。
 */
userAuthRoutes.delete("/me/gallery/:id", requireAuth, async (c) => {
  const userId = Number(c.get("user").sub);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ ok: false, error: "invalid id" }, 400);
  }
  const objectKey = await deleteGalleryImage(id, userId);
  if (!objectKey) {
    return c.json({ ok: false, error: "not found" }, 404);
  }
  // DB 行は消えた。オブジェクト削除はベストエフォート（失敗しても孤児が残るだけ）。
  try {
    await deleteObject({ bucket: getPrivateBucket(), key: objectKey });
  } catch {
    // 孤児は許容。
  }
  return c.json({ ok: true });
});

userAuthRoutes.route("/", userAuth.routes);
