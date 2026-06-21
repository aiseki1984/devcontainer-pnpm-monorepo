import { describe, it, expect } from "vitest";
import { contactSchema } from "./index.js";

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
