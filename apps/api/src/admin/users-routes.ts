import { Hono } from "hono";
import { paginationSchema } from "@pnpm-test-workspace/validators";
import {
  countUsers,
  getUserPublicById,
  listActiveUserRefreshTokensByUserId,
  listUsersPage,
  revokeAllUserRefreshTokens,
  revokeUserRefreshTokenForUser,
} from "@pnpm-test-workspace/db";
import { requireAdmin } from "../auth/middleware.js";

/**
 * 管理者によるユーザー管理ルート（/admin/users 配下）。すべて requireAdmin で保護する。
 * 一般ユーザーの一覧・詳細の閲覧と、ログインセッション（refresh token）の失効を担う。
 */
export const adminUserRoutes = new Hono();

/** Postgres の serial（int4）の最大値。これを超える id は DB に渡すと範囲外エラーになる。 */
const PG_INT4_MAX = 2_147_483_647;

/**
 * path param の id を正の整数として検証する。不正なら null。
 * int4 の範囲外（> PG_INT4_MAX）も弾く。これを許すと getUserById 等のクエリで
 * "value out of range for type integer" が投げられ 400/404 ではなく 500 になる。
 */
function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 && id <= PG_INT4_MAX ? id : null;
}

// 管理者だけが、登録ユーザーを新しい順・ページ単位で取得できる。
adminUserRoutes.get("/admin/users", requireAdmin, async (c) => {
  // 不正な query はデフォルト（page=1, perPage=20）に倒れる（paginationSchema の .catch）。
  const { page, perPage } = paginationSchema.parse({
    page: c.req.query("page"),
    perPage: c.req.query("perPage"),
  });
  const [rows, total] = await Promise.all([
    listUsersPage({ limit: perPage, offset: (page - 1) * perPage }),
    countUsers(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return c.json({
    ok: true,
    data: rows,
    pagination: { page, perPage, total, totalPages },
  });
});

// 管理者だけが、ユーザー 1 件の詳細を取得できる（password_hash は返さない）。
adminUserRoutes.get("/admin/users/:id", requireAdmin, async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) {
    return c.json({ ok: false, error: "invalid id" }, 400);
  }
  const user = await getUserPublicById(id);
  if (!user) {
    return c.json({ ok: false, error: "not found" }, 404);
  }
  return c.json({ ok: true, data: user });
});

// あるユーザーの有効なログインセッション（アクティブな refresh token）の一覧。
adminUserRoutes.get("/admin/users/:id/sessions", requireAdmin, async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) {
    return c.json({ ok: false, error: "invalid id" }, 400);
  }
  const sessions = await listActiveUserRefreshTokensByUserId(id);
  return c.json({ ok: true, data: sessions });
});

// あるユーザーの全セッションを失効させる（強制ログアウト＝全デバイス）。
// 注（モデルA / ステートレス）: ここで失効するのは「新しい access を取り直す経路」。
// 既存の access JWT は exp（15分）まで有効なので、ユーザーは即座には弾かれず、
// 次の silent refresh が 401 になった時点でログアウトされる。
adminUserRoutes.post(
  "/admin/users/:id/sessions/revoke",
  requireAdmin,
  async (c) => {
    const id = parseId(c.req.param("id"));
    if (id === null) {
      return c.json({ ok: false, error: "invalid id" }, 400);
    }
    await revokeAllUserRefreshTokens(id);
    return c.json({ ok: true });
  },
);

// あるユーザーの特定セッション 1 件だけを失効させる。
adminUserRoutes.post(
  "/admin/users/:id/sessions/:sessionId/revoke",
  requireAdmin,
  async (c) => {
    const id = parseId(c.req.param("id"));
    const sessionId = parseId(c.req.param("sessionId"));
    if (id === null || sessionId === null) {
      return c.json({ ok: false, error: "invalid id" }, 400);
    }
    const revoked = await revokeUserRefreshTokenForUser({
      userId: id,
      id: sessionId,
    });
    return c.json({ ok: true, revoked });
  },
);
