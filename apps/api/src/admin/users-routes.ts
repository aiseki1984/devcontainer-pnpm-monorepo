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
import { paginatedBody, parseId } from "../lib/http.js";

/**
 * 管理者によるユーザー管理ルート（/admin/users 配下）。すべて requireAdmin で保護する。
 * 一般ユーザーの一覧・詳細の閲覧と、ログインセッション（refresh token）の失効を担う。
 */
export const adminUserRoutes = new Hono();

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
  return c.json(paginatedBody(rows, { page, perPage, total }));
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
    // 失効できなかった = そのユーザーの有効なセッションとして存在しない
    // （別ユーザーの／既に失効済み／存在しない id）。no-op を成功偽装せず 404 にする。
    if (!revoked) {
      return c.json({ ok: false, error: "session not found" }, 404);
    }
    return c.json({ ok: true });
  },
);
