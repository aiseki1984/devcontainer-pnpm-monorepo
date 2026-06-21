# @pnpm-test-workspace/validators

フロント（web）と API（api）で共有するバリデーション schema。
schema から型も導出し、入力検証と型付けを一元化する。

## 使い方

```ts
import {
  contactSchema,
  type ContactInput,
} from "@pnpm-test-workspace/validators";

const result = contactSchema.safeParse(input);
```

## ビルドして配布する理由

このパッケージは **`src` の TypeScript を直接 export せず、`tsc` でコンパイルした `dist`（JS + `.d.ts`）を `exports` で公開**している。

理由は、ソース（`.ts`）を直接 export すると消費側で次の問題が起きるため:

- **api（本番）**: `node dist/index.js` 実行時に `.ts` を解決してしまい、Node が実行できず落ちる。
- **web**: Next.js は node_modules 内の `.ts` をデフォルトで変換しないため `transpilePackages` が必要になる。

`dist` を公開することで、消費側は素の `tsc` ビルド / `node` 実行 / Next.js のいずれでも追加設定なしで利用できる。

## 注意

- `dist` は生成物のため git 管理外（[.gitignore](.gitignore)）。
- 消費側の `build` / `typecheck` は turbo の `^build` 依存でこのパッケージの `dist` を先に生成する（[turbo.json](../../turbo.json)）。手動で型解決させたい場合は `pnpm --filter @pnpm-test-workspace/validators build`。
