import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

/**
 * 認証 Cookie のヘルパー。トークンは body ではなく HttpOnly Cookie で渡す（XSS 窃取対策）。
 * access は全パス、refresh は /auth 配下（refresh と logout）にだけ送る。
 */
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const isProd = process.env.NODE_ENV === "production";
// セッション窓（30日）。access/refresh の Cookie 寿命はこれに揃える。
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** refresh トークンの寿命（ミリ秒）。DB の expires_at 計算に使う。 */
export const REFRESH_MAX_AGE_MS = SESSION_MAX_AGE * 1000;

export function setAccessCookie(c: Context, token: string): void {
  setCookie(c, ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isProd, // 本番(HTTPS)のみ Secure
    path: "/",
    // 中の JWT 自体は短命（15分・jwt.ts）。Cookie はセッション窓まで残し、
    // 期限切れ JWT でも「セッションあり」の印として proxy にページを通させる。
    // 実際の更新はクライアントが /auth/refresh を叩いて行う。
    maxAge: SESSION_MAX_AGE,
  });
}

export function setRefreshCookie(c: Context, token: string): void {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isProd,
    path: "/auth", // refresh と logout にだけ送られる
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearAuthCookies(c: Context): void {
  deleteCookie(c, ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/auth" });
}
