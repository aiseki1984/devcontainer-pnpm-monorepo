import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  contactSchema,
  paginationSchema,
} from "@pnpm-test-workspace/validators";
import {
  countContacts,
  createContact,
  getContactById,
  listContactsPage,
} from "@pnpm-test-workspace/db";
import { userAuthRoutes } from "./auth/user-routes.js";
import { adminAuthRoutes } from "./auth/admin-routes.js";
import { adminUserRoutes } from "./admin/users-routes.js";
import { requireAdmin } from "./auth/middleware.js";
import { paginatedBody, parseId } from "./lib/http.js";

const app = new Hono();

// Cookie 併用のクロスオリジンでは Allow-Origin に "*" を使えないので許可リストで明示する。
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const adminOrigin = process.env.ADMIN_ORIGIN ?? "http://localhost:3001";
app.use("/*", cors({ origin: [webOrigin, adminOrigin], credentials: true }));

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// 一般ユーザーの認証（/auth/register, /auth/login, /auth/logout, /auth/refresh, /me）。
app.route("/", userAuthRoutes);

// 管理者の認証（/admin/auth/login, /admin/auth/logout, /admin/auth/refresh, /admin/me）。
app.route("/", adminAuthRoutes);

// 管理者によるユーザー管理（/admin/users 配下: 一覧・詳細・セッション失効）。
app.route("/", adminUserRoutes);

// 共有スキーマで受信ボディを検証し、DB に保存する。
app.post("/contact", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { errors: { formErrors: ["invalid JSON"], fieldErrors: {} } },
      400,
    );
  }
  const result = contactSchema.safeParse(body);
  if (!result.success) {
    return c.json({ errors: result.error.flatten() }, 400);
  }
  // 入力検証は validators、永続化は db のクエリヘルパーに委譲する。
  const created = await createContact(result.data);
  return c.json({ ok: true, data: created }, 201);
});

// 管理者だけが、保存済みのお問い合わせ一覧を新しい順・ページ単位で取得できる。
app.get("/admin/contacts", requireAdmin, async (c) => {
  // 不正な query はデフォルト（page=1, perPage=20）に倒れる（paginationSchema の .catch）。
  const { page, perPage } = paginationSchema.parse({
    page: c.req.query("page"),
    perPage: c.req.query("perPage"),
  });
  const [rows, total] = await Promise.all([
    listContactsPage({ limit: perPage, offset: (page - 1) * perPage }),
    countContacts(),
  ]);
  return c.json(paginatedBody(rows, { page, perPage, total }));
});

// 管理者だけが、お問い合わせ 1 件の詳細を取得できる。
app.get("/admin/contacts/:id", requireAdmin, async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) {
    return c.json({ ok: false, error: "invalid id" }, 400);
  }
  const contact = await getContactById(id);
  if (!contact) {
    return c.json({ ok: false, error: "not found" }, 404);
  }
  return c.json({ ok: true, data: contact });
});

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.API_PORT ?? 8787),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
