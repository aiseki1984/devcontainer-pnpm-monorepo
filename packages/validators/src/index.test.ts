import { describe, it, expect } from "vitest";
import { contactSchema, safeNextPath, sniffAvatarImageMime } from "./index.js";

describe("sniffAvatarImageMime", () => {
  it("JPEG の magic number を判定する", () => {
    expect(sniffAvatarImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(
      "image/jpeg",
    );
  });

  it("PNG の magic number を判定する", () => {
    expect(
      sniffAvatarImageMime(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
  });

  it("WebP（RIFF....WEBP）を判定する", () => {
    const head = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffAvatarImageMime(head)).toBe("image/webp");
  });

  it("画像でないバイト列（HTML 等）は null", () => {
    // "<html>..." を名乗る非画像
    const head = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]);
    expect(sniffAvatarImageMime(head)).toBeNull();
  });

  it("バイト不足でも誤判定しない", () => {
    expect(sniffAvatarImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffAvatarImageMime(new Uint8Array(0))).toBeNull();
  });
});

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
