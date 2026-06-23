import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { loginSchema } from "@pnpm-test-workspace/validators";
import {
  createAdminRefreshToken,
  findAdminRefreshTokenByHash,
  getAdminByEmail,
  getAdminById,
  revokeAdminRefreshToken,
  revokeAllAdminRefreshTokens,
  type Admin,
} from "@pnpm-test-workspace/db";
import {
  DUMMY_PASSWORD_HASH,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyPassword,
} from "@pnpm-test-workspace/auth";
import type { Context } from "hono";
import {
  ADMIN_REFRESH_COOKIE,
  clearAdminCookies,
  REFRESH_MAX_AGE_MS,
  setAdminAccessCookie,
  setAdminRefreshCookie,
} from "./cookies.js";
import { requireAdmin } from "./middleware.js";

/** 管理者向け認証ルート（/admin/auth/* と /admin/me）。自己登録は無く seed で投入する。 */
export const adminAuthRoutes = new Hono();

/** password_hash を落とした、外部に返してよい管理者表現。 */
function publicAdmin(admin: Admin) {
  return { id: admin.id, email: admin.email, name: admin.name, role: "admin" };
}

/** admin の access JWT（role:"admin"）を発行し、refresh を保存して両 Cookie に載せる。 */
async function issueAdminSession(c: Context, admin: Admin): Promise<void> {
  const accessToken = await signAccessToken({
    sub: String(admin.id),
    role: "admin",
    email: admin.email,
  });
  const { token, tokenHash } = generateRefreshToken();
  await createAdminRefreshToken({
    adminId: admin.id,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
  });
  setAdminAccessCookie(c, accessToken);
  setAdminRefreshCookie(c, token);
}

adminAuthRoutes.post("/admin/auth/login", async (c) => {
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
  const admin = await getAdminByEmail(parsed.data.email);
  // 不在でもダミーハッシュを検証し、email の存在有無を応答時間で漏らしにくくする。
  const passwordMatches = await verifyPassword(
    admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
    parsed.data.password,
  );
  if (!admin || !passwordMatches) {
    return c.json({ ok: false, error: "invalid email or password" }, 401);
  }
  await issueAdminSession(c, admin);
  return c.json({ ok: true, admin: publicAdmin(admin) });
});

adminAuthRoutes.post("/admin/auth/logout", async (c) => {
  const raw = getCookie(c, ADMIN_REFRESH_COOKIE);
  if (raw) {
    const row = await findAdminRefreshTokenByHash(hashRefreshToken(raw));
    if (row) {
      await revokeAdminRefreshToken(row.id);
    }
  }
  clearAdminCookies(c);
  return c.json({ ok: true });
});

adminAuthRoutes.post("/admin/auth/refresh", async (c) => {
  const raw = getCookie(c, ADMIN_REFRESH_COOKIE);
  if (!raw) {
    return c.json({ ok: false, error: "no refresh token" }, 401);
  }
  const row = await findAdminRefreshTokenByHash(hashRefreshToken(raw));
  if (!row) {
    clearAdminCookies(c);
    return c.json({ ok: false, error: "invalid refresh token" }, 401);
  }
  if (row.revokedAt) {
    await revokeAllAdminRefreshTokens(row.adminId);
    clearAdminCookies(c);
    return c.json({ ok: false, error: "refresh token reuse detected" }, 401);
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await revokeAdminRefreshToken(row.id);
    clearAdminCookies(c);
    return c.json({ ok: false, error: "refresh token expired" }, 401);
  }
  const admin = await getAdminById(row.adminId);
  if (!admin) {
    clearAdminCookies(c);
    return c.json({ ok: false, error: "admin not found" }, 401);
  }
  const rotated = await revokeAdminRefreshToken(row.id);
  if (!rotated) {
    clearAdminCookies(c);
    return c.json({ ok: false, error: "refresh token already used" }, 401);
  }
  await issueAdminSession(c, admin);
  return c.json({ ok: true, admin: publicAdmin(admin) });
});

adminAuthRoutes.get("/admin/me", requireAdmin, async (c) => {
  const payload = c.get("user");
  const admin = await getAdminById(Number(payload.sub));
  if (!admin) {
    return c.json({ ok: false, error: "admin not found" }, 401);
  }
  return c.json({ ok: true, admin: publicAdmin(admin) });
});
