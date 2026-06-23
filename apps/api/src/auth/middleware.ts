import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import {
  verifyAccessToken,
  type AccessTokenPayload,
} from "@pnpm-test-workspace/auth";
import { ACCESS_COOKIE } from "./cookies.js";

/** requireAuth が検証後に c.set("user", ...) で載せる Context 変数の型。 */
export type AuthVariables = { user: AccessTokenPayload };

/**
 * access Cookie を検証し、payload を c.set("user") に載せる保護ミドルウェア。
 * 未認証（Cookie 無し）や無効トークンなら後続ハンドラを呼ばず 401 を返す。
 * 保護したいルートに付けるだけでよい。
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const token = getCookie(c, ACCESS_COOKIE);
    if (!token) {
      return c.json({ ok: false, error: "not authenticated" }, 401);
    }
    try {
      c.set("user", await verifyAccessToken(token));
    } catch {
      return c.json({ ok: false, error: "invalid token" }, 401);
    }
    await next();
  },
);
