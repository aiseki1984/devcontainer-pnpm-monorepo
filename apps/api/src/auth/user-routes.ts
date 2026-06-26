import { Hono } from "hono";
import {
  AVATAR_MAX_BYTES,
  avatarExtForMime,
  avatarPresignSchema,
  registerSchema,
  sniffAvatarImageMime,
  updateMeSchema,
} from "@pnpm-test-workspace/validators";
import {
  createUser,
  createUserRefreshToken,
  findUserRefreshTokenByHash,
  getUserByEmail,
  getUserById,
  revokeAllUserRefreshTokens,
  revokeUserRefreshToken,
  updateUserAvatar,
} from "@pnpm-test-workspace/db";
import {
  buildAvatarKey,
  deleteAvatarObject,
  presignAvatarDownload,
  presignAvatarUpload,
  readAvatarHead,
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
  const ext = avatarExtForMime(parsed.data.contentType);
  const key = buildAvatarKey(userId, ext);
  const { url, fields } = await presignAvatarUpload({
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
  // presign が発行する形（{userId}/{uuid}.{ext}）だけを受け付ける。プレフィックス
  // 一致だけだと拡張子なしや任意サフィックスも通ってしまうため、キー全体を検証する。
  // userId は数値なので正規表現へ埋めても安全。
  const avatarKeyPattern = new RegExp(
    `^${userId}/[0-9a-f-]+\\.(jpg|png|webp)$`,
  );
  const keyMatch = avatarKeyPattern.exec(parsed.data.avatarKey);
  if (!keyMatch) {
    return c.json({ ok: false, error: "invalid avatar key" }, 400);
  }
  const key = parsed.data.avatarKey;
  const keyExt = keyMatch[1];

  // 内容（magic number）検証。presigned POST は宣言 Content-Type しか縛れず中身は見ない
  // ため、保存前に実バイト先頭を読んで実体が JPEG/PNG/WebP か、かつキー拡張子と一致するか
  // を確認する。不一致なら不正オブジェクトを掃除して 400（key 自体は自分の名前空間内なので削除可）。
  let head: Uint8Array;
  try {
    head = await readAvatarHead(key);
  } catch {
    // オブジェクトが存在しない（PUT 未完了など）。
    return c.json({ ok: false, error: "avatar object not found" }, 400);
  }
  const sniffed = sniffAvatarImageMime(head);
  if (!sniffed || avatarExtForMime(sniffed) !== keyExt) {
    await deleteAvatarObject(key);
    return c.json({ ok: false, error: "invalid avatar content" }, 400);
  }

  const updated = await updateUserAvatar(userId, parsed.data.avatarKey);
  if (!updated) {
    return c.json({ ok: false, error: "user not found" }, 404);
  }
  // 公開形の整形は route-factory の publicAccount に集約（/me・login と同じ形）。
  return c.json({ ok: true, user: userAuth.publicAccount(updated) });
});

/**
 * 現在のアバターの表示用 presigned GET URL を返す（バケットは非公開）。
 * URL には有効期限があるため、表示のたびに取得し直せるよう /me とは別の専用経路にする。
 * 未設定なら url: null。
 */
userAuthRoutes.get("/me/avatar", requireAuth, async (c) => {
  const userId = Number(c.get("user").sub);
  const user = await getUserById(userId);
  if (!user) {
    return c.json({ ok: false, error: "user not found" }, 401);
  }
  if (!user.avatarKey) {
    return c.json({ ok: true, url: null });
  }
  const url = await presignAvatarDownload({ key: user.avatarKey });
  return c.json({ ok: true, url });
});

userAuthRoutes.route("/", userAuth.routes);
