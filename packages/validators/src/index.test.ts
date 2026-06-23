import { describe, it, expect } from "vitest";
import { contactSchema, safeNextPath } from "./index.js";

describe("contactSchema", () => {
  it("全項目揃えば通す", () => {
    const r = contactSchema.safeParse({
      name: "佐藤",
      email: "s@example.com",
      title: "件名",
      message: "本文",
    });
    expect(r.success).toBe(true);
  });

  it("空項目を弾く", () => {
    const r = contactSchema.safeParse({
      name: "",
      email: "bad",
      title: "",
      message: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("safeNextPath", () => {
  const origin = "http://localhost:3001";
  const fallback = "/dashboard";

  it("同一オリジンの内部パスはそのまま返す", () => {
    expect(safeNextPath("/contacts?page=2", origin, fallback)).toBe(
      "/contacts?page=2",
    );
  });

  it("同一オリジンの絶対 URL は pathname+search に正規化して返す", () => {
    expect(
      safeNextPath("http://localhost:3001/contacts?page=2", origin, fallback),
    ).toBe("/contacts?page=2");
  });

  it("バックスラッシュ・バイパス（/\\evil.com）を弾く", () => {
    // WHATWG URL は \ を / に正規化し http://evil.com/ に解決される → fallback
    expect(safeNextPath("/\\evil.com", origin, fallback)).toBe(fallback);
  });

  it("プロトコル相対（//evil.com）を弾く", () => {
    expect(safeNextPath("//evil.com", origin, fallback)).toBe(fallback);
  });

  it("外部オリジンの絶対 URL を弾く", () => {
    expect(safeNextPath("https://evil.com/x", origin, fallback)).toBe(fallback);
  });

  it("null/空文字は fallback", () => {
    expect(safeNextPath(null, origin, fallback)).toBe(fallback);
    expect(safeNextPath("", origin, fallback)).toBe(fallback);
  });
});
