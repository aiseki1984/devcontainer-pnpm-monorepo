import { SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

const secret = "test-secret-at-least-long-enough";
const key = new TextEncoder().encode(secret);

beforeEach(() => {
  process.env.JWT_SECRET = secret;
});

describe("access JWT", () => {
  it("HS256 の user トークンを user audience として検証できる", async () => {
    const token = await signAccessToken({
      sub: "1",
      role: "user",
      email: "user@example.com",
    });

    await expect(
      verifyAccessToken(token, { audience: "user" }),
    ).resolves.toEqual({
      sub: "1",
      role: "user",
      email: "user@example.com",
    });
  });

  it("audience が違うトークンは弾く", async () => {
    const token = await signAccessToken({
      sub: "1",
      role: "user",
      email: "user@example.com",
    });

    await expect(
      verifyAccessToken(token, { audience: "admin" }),
    ).rejects.toThrow();
  });

  it("HS256 以外の署名アルゴリズムは弾く", async () => {
    const token = await new SignJWT({
      role: "user",
      email: "user@example.com",
    })
      .setProtectedHeader({ alg: "HS384" })
      .setSubject("1")
      .setAudience("user")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);

    await expect(
      verifyAccessToken(token, { audience: "user" }),
    ).rejects.toThrow();
  });

  it("role が user/admin 以外なら弾く", async () => {
    const token = await new SignJWT({
      role: "operator",
      email: "user@example.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setAudience("user")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);

    await expect(
      verifyAccessToken(token, { audience: "user" }),
    ).rejects.toThrow();
  });
});
