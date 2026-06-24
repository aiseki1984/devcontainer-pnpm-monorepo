import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import {
  verifyAccessToken,
  type Role,
  type AccessTokenPayload,
} from "@pnpm-test-workspace/auth";
import { ACCESS_COOKIE, ADMIN_ACCESS_COOKIE } from "./cookies.js";

/** requireAuth / requireAdmin が検証後に c.set("user", ...) で載せる Context 変数の型。 */
export type AuthVariables = { user: AccessTokenPayload };

/**
 * role ごとの access Cookie を検証し、payload を c.set("user") に載せる保護ミドルウェア。
 * audience と role は JWT 検証時点で固定し、user/admin トークンの取り違えを防ぐ。
 */
function createRequireAuth(role: Role, cookieName: string) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const token = getCookie(c, cookieName);
    if (!token) {
      return c.json({ ok: false, error: "not authenticated" }, 401);
    }
    let payload: AccessTokenPayload;
    try {
      payload = await verifyAccessToken(token, { audience: role });
    } catch {
      return c.json({ ok: false, error: "invalid token" }, 401);
    }
    if (payload.role !== role) {
      return c.json({ ok: false, error: "forbidden" }, 403);
    }
    c.set("user", payload);
    await next();
  });
}

export const requireAuth = createRequireAuth("user", ACCESS_COOKIE);
export const requireAdmin = createRequireAuth("admin", ADMIN_ACCESS_COOKIE);
