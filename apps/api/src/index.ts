import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { contactSchema } from "@pnpm-test-workspace/validators";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// 共有スキーマで受信ボディを検証する例
app.post("/contact", async (c) => {
  const body = await c.req.json();
  const result = contactSchema.safeParse(body);
  if (!result.success) {
    return c.json({ errors: result.error.flatten() }, 400);
  }
  return c.json({ ok: true, data: result.data });
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
