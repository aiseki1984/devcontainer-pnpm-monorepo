import { Hono } from "hono";
import { registerSchema } from "@pnpm-test-workspace/validators";
import {
  createUser,
  createUserRefreshToken,
  findUserRefreshTokenByHash,
  getUserByEmail,
  getUserById,
  revokeAllUserRefreshTokens,
  revokeUserRefreshToken,
} from "@pnpm-test-workspace/db";
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
  responseKey: "user",
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

userAuthRoutes.route("/", userAuth.routes);
