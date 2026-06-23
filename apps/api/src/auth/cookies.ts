import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

/**
 * 認証 Cookie のヘルパー。トークンは body ではなく HttpOnly Cookie で渡す（XSS 窃取対策）。
 * user と admin で Cookie 名を分け、取り違えを防ぐ。
 * access は全パス、refresh は各認証ルート配下（/auth, /admin/auth）にだけ送る。
 */
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const ADMIN_ACCESS_COOKIE = "admin_access_token";
export const ADMIN_REFRESH_COOKIE = "admin_refresh_token";

const isProd = process.env.NODE_ENV === "production";
// セッション窓（30日）。access/refresh の Cookie 寿命はこれに揃える。
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const base = { httpOnly: true, sameSite: "Lax", secure: isProd } as const;

/** refresh トークンの寿命（ミリ秒）。DB の expires_at 計算に使う。 */
export const REFRESH_MAX_AGE_MS = SESSION_MAX_AGE * 1000;

// access の Cookie はセッション窓まで残す（中の JWT は短命=15分。proxy のゲートには
// Cookie の「存在」を使い、実際の更新はクライアントが refresh エンドポイントで行う）。
function setAccess(c: Context, name: string, token: string): void {
  setCookie(c, name, token, { ...base, path: "/", maxAge: SESSION_MAX_AGE });
}
function setRefresh(
  c: Context,
  name: string,
  path: string,
  token: string,
): void {
  setCookie(c, name, token, { ...base, path, maxAge: SESSION_MAX_AGE });
}

// --- 一般ユーザー ---
export function setAccessCookie(c: Context, token: string): void {
  setAccess(c, ACCESS_COOKIE, token);
}
export function setRefreshCookie(c: Context, token: string): void {
  setRefresh(c, REFRESH_COOKIE, "/auth", token);
}
export function clearAuthCookies(c: Context): void {
  deleteCookie(c, ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/auth" });
}

// --- 管理者 ---
export function setAdminAccessCookie(c: Context, token: string): void {
  setAccess(c, ADMIN_ACCESS_COOKIE, token);
}
export function setAdminRefreshCookie(c: Context, token: string): void {
  setRefresh(c, ADMIN_REFRESH_COOKIE, "/admin/auth", token);
}
export function clearAdminCookies(c: Context): void {
  deleteCookie(c, ADMIN_ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, ADMIN_REFRESH_COOKIE, { path: "/admin/auth" });
}
