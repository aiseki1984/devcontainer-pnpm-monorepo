import { Hono } from "hono";
import {
  createAdminRefreshToken,
  findAdminRefreshTokenByHash,
  getAdminByEmail,
  getAdminById,
  revokeAdminRefreshToken,
  revokeAllAdminRefreshTokens,
} from "@pnpm-test-workspace/db";
import {
  ADMIN_REFRESH_COOKIE,
  clearAdminCookies,
  setAdminAccessCookie,
  setAdminRefreshCookie,
} from "./cookies.js";
import { requireAdmin } from "./middleware.js";
import { createAuthRoutes } from "./route-factory.js";

/** 管理者向け認証ルート（/admin/auth/* と /admin/me）。自己登録は無く seed で投入する。 */
export const adminAuthRoutes = new Hono();

const adminAuth = createAuthRoutes({
  role: "admin",
  responseKey: "admin",
  loginPath: "/admin/auth/login",
  logoutPath: "/admin/auth/logout",
  refreshPath: "/admin/auth/refresh",
  mePath: "/admin/me",
  refreshCookie: ADMIN_REFRESH_COOKIE,
  getByEmail: getAdminByEmail,
  getById: getAdminById,
  createRefreshToken: ({ accountId, tokenHash, expiresAt }) =>
    createAdminRefreshToken({ adminId: accountId, tokenHash, expiresAt }),
  findRefreshTokenByHash: findAdminRefreshTokenByHash,
  getRefreshAccountId: (row) => row.adminId,
  revokeRefreshToken: revokeAdminRefreshToken,
  revokeAllRefreshTokens: revokeAllAdminRefreshTokens,
  setAccessCookie: setAdminAccessCookie,
  setRefreshCookie: setAdminRefreshCookie,
  clearCookies: clearAdminCookies,
  requireRole: requireAdmin,
});

adminAuthRoutes.route("/", adminAuth.routes);
