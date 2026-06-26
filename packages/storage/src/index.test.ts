import { describe, it, expect } from "vitest";
import { buildObjectKey, publicObjectUrl } from "./index.js";

describe("buildObjectKey", () => {
  it("{prefix}/{userId}/{uuid}.{ext} 形式で組み立てる", () => {
    const key = buildObjectKey("avatars", 42, "png");
    expect(key).toMatch(/^avatars\/42\/[0-9a-f-]{36}\.png$/);
  });

  it("呼ぶたびにランダム部が変わる（キャッシュ更新のため）", () => {
    expect(buildObjectKey("gallery", 1, "jpg")).not.toBe(
      buildObjectKey("gallery", 1, "jpg"),
    );
  });
});

describe("publicObjectUrl", () => {
  it("公開ベース URL + key で固定 URL を組み立てる", () => {
    process.env.S3_PUBLIC_BASE_URL = "http://media-public.web.localhost:3902";
    expect(publicObjectUrl("avatars/1/abc.png")).toBe(
      "http://media-public.web.localhost:3902/avatars/1/abc.png",
    );
  });
});
