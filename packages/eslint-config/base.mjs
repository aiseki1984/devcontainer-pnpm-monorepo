import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Node / ライブラリ系パッケージ向けの共通 ESLint 設定。
 * api / validators など、Next.js を使わないパッケージで利用する。
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
