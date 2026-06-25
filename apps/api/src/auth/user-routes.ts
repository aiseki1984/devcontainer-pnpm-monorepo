import { Hono } from "hono";
import {
  avatarExtForMime,
  avatarPresignSchema,
  registerSchema,
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
  presignAvatarDownload,
  presignAvatarUpload,
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
 * アバターアップロード用の presigned PUT URL を発行する。
 * クライアントは MIME / サイズを申告し、検証を通れば直接 Garage へ PUT できる URL と
 * 保存予定のオブジェクトキーを受け取る。実バイトは API を経由しない（方式 A）。
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
  const uploadUrl = await presignAvatarUpload({
    key,
    contentType: parsed.data.contentType,
  });
  return c.json({ ok: true, uploadUrl, key });
});

/**
 * アップロード完了後にアバターのオブジェクトキーを保存する。
 * クライアントが渡すキーは自分の名前空間（avatars/{自分の id}/）配下に限定し、
 * 他ユーザーのキー詐称を防ぐ（presign で発行したキーと同形であることの最低限の担保）。
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
  if (!parsed.data.avatarKey.startsWith(`${userId}/`)) {
    return c.json({ ok: false, error: "invalid avatar key" }, 400);
  }
  const updated = await updateUserAvatar(userId, parsed.data.avatarKey);
  if (!updated) {
    return c.json({ ok: false, error: "user not found" }, 404);
  }
  return c.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarKey: updated.avatarKey,
      role: "user" as const,
    },
  });
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
