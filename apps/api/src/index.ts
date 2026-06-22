import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { contactSchema } from "@pnpm-test-workspace/validators";
import { createContact, listContacts } from "@pnpm-test-workspace/db";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// 共有スキーマで受信ボディを検証し、DB に保存する。
app.post("/contact", async (c) => {
  const body = await c.req.json();
  const result = contactSchema.safeParse(body);
  if (!result.success) {
    return c.json({ errors: result.error.flatten() }, 400);
  }
  // 入力検証は validators、永続化は db のクエリヘルパーに委譲する。
  const created = await createContact(result.data);
  return c.json({ ok: true, data: created }, 201);
});

// 保存済みのお問い合わせ一覧を新しい順で返す。
app.get("/contacts", async (c) => {
  const rows = await listContacts();
  return c.json({ ok: true, data: rows });
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
