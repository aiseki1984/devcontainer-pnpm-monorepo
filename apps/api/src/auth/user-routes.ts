import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { loginSchema, registerSchema } from "@pnpm-test-workspace/validators";
import {
  createUser,
  createUserRefreshToken,
  findUserRefreshTokenByHash,
  getUserByEmail,
  getUserById,
  revokeAllUserRefreshTokens,
  revokeUserRefreshToken,
  type User,
} from "@pnpm-test-workspace/db";
import {
  DUMMY_PASSWORD_HASH,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyPassword,
} from "@pnpm-test-workspace/auth";
import type { Context } from "hono";
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_MS,
  setAccessCookie,
  setRefreshCookie,
} from "./cookies.js";
import { requireAuth } from "./middleware.js";

/** 一般ユーザー向け認証ルート（/auth/* と /me）。 */
export const userAuthRoutes = new Hono();

/** password_hash を落とした、外部に返してよいユーザー表現。 */
function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name };
}

/** access JWT を発行し、refresh を生成・DB 保存し、両方を Cookie に載せる。 */
async function issueSession(c: Context, user: User): Promise<void> {
  const accessToken = await signAccessToken({
    sub: String(user.id),
    role: "user",
    email: user.email,
  });
  const { token, tokenHash } = generateRefreshToken();
  await createUserRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
  });
  setAccessCookie(c, accessToken);
  setRefreshCookie(c, token);
}

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
  await issueSession(c, user);
  return c.json({ ok: true, user: publicUser(user) }, 201);
});

userAuthRoutes.post("/auth/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid JSON" }, 400);
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      400,
    );
  }
  const user = await getUserByEmail(parsed.data.email);
  // 不在でもダミーハッシュを検証し、email の存在有無を応答時間で漏らしにくくする。
  const passwordMatches = await verifyPassword(
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    parsed.data.password,
  );
  if (!user || !passwordMatches) {
    return c.json({ ok: false, error: "invalid email or password" }, 401);
  }
  await issueSession(c, user);
  return c.json({ ok: true, user: publicUser(user) });
});

userAuthRoutes.post("/auth/logout", async (c) => {
  const raw = getCookie(c, REFRESH_COOKIE);
  if (raw) {
    const row = await findUserRefreshTokenByHash(hashRefreshToken(raw));
    if (row) {
      await revokeUserRefreshToken(row.id);
    }
  }
  clearAuthCookies(c);
  return c.json({ ok: true });
});

userAuthRoutes.post("/auth/refresh", async (c) => {
  const raw = getCookie(c, REFRESH_COOKIE);
  if (!raw) {
    return c.json({ ok: false, error: "no refresh token" }, 401);
  }
  const row = await findUserRefreshTokenByHash(hashRefreshToken(raw));
  if (!row) {
    clearAuthCookies(c);
    return c.json({ ok: false, error: "invalid refresh token" }, 401);
  }
  // 失効済みトークンの使用 = ローテーション後の使い回し（盗難の疑い）→ 全トークンを失効。
  if (row.revokedAt) {
    await revokeAllUserRefreshTokens(row.userId);
    clearAuthCookies(c);
    return c.json({ ok: false, error: "refresh token reuse detected" }, 401);
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await revokeUserRefreshToken(row.id);
    clearAuthCookies(c);
    return c.json({ ok: false, error: "refresh token expired" }, 401);
  }
  const user = await getUserById(row.userId);
  if (!user) {
    clearAuthCookies(c);
    return c.json({ ok: false, error: "user not found" }, 401);
  }
  // 古い refresh を条件付きで失効（revoked_at IS NULL の時だけ）。同時リクエストでは
  // 1 つだけが成功し、残りは失効済みとして弾く → 1 トークンから複数セッションが出るのを防ぐ。
  const rotated = await revokeUserRefreshToken(row.id);
  if (!rotated) {
    clearAuthCookies(c);
    return c.json({ ok: false, error: "refresh token already used" }, 401);
  }
  await issueSession(c, user);
  return c.json({ ok: true, user: publicUser(user) });
});

// 保護ルート: requireAuth が access Cookie を検証し c.get("user") に payload を載せる。
userAuthRoutes.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({
    ok: true,
    user: { id: Number(user.sub), email: user.email, role: user.role },
  });
});
