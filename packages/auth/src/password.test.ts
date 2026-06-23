import { describe, expect, it } from "vitest";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "./password.js";

describe("password hashing", () => {
  it("hashPassword の結果を verifyPassword で検証できる", async () => {
    const hash = await hashPassword("correct-password");

    await expect(verifyPassword(hash, "correct-password")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("ダミーハッシュは不在ユーザーの timing 均一化に使える", async () => {
    await expect(
      verifyPassword(DUMMY_PASSWORD_HASH, "wrong-password"),
    ).resolves.toBe(false);
  });
});
