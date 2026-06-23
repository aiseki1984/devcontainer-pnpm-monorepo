# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack & layout

pnpm workspaces + Turborepo monorepo. Node >=24, pnpm 11.5.3.

- `apps/web` — Next.js 16, end-user app (port 3000)
- `apps/admin` — Next.js 16, admin app (port 3001)
- `apps/api` — Hono backend, single API for both frontends (port from `API_PORT`, default 8787)
- `packages/validators` — Zod schemas shared by front+back (input validation source of truth)
- `packages/auth` — framework-agnostic auth primitives (argon2 hashing, jose JWT, refresh-token crypto)
- `packages/db` — Drizzle ORM: schema, migrations, and query helpers
- `packages/ui` — shared UI (shadcn/ui based)
- `packages/tsconfig`, `packages/eslint-config` — shared configs consumed as workspace packages

Workspace package names are `@pnpm-test-workspace/<name>`.

## Commands

Run from the repo root (root scripts wrap Turbo and load `.env` via dotenv-cli):

- `pnpm dev` — all apps; `pnpm dev:api` — api only
- `pnpm build` / `pnpm lint` / `pnpm typecheck` — Turbo across the workspace
- `pnpm test` — all tests (vitest); `pnpm ci` = format:check + lint + typecheck + build (run before pushing; the pre-push hook runs this)
- DB: `pnpm db:generate` (SQL from schema), `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:studio`, `pnpm db:reset` (drop → migrate → seed)

Scope to one package with `--filter`, e.g.:

- `pnpm --filter @pnpm-test-workspace/api dev`
- `pnpm --filter @pnpm-test-workspace/validators test` (run a single package's tests)
- A single test file: `pnpm --filter @pnpm-test-workspace/db exec vitest run src/foo.test.ts`

Husky runs lint-staged (prettier) on commit and `pnpm ci` on push.

## Critical conventions (these have bitten us)

- **Internal packages are built and consumed from `dist`, not `src`.** `validators`, `auth`, and `db` compile with `tsc -p tsconfig.build.json` and expose `dist` via `exports`. Consumers (api/web/admin) import the built output — so after changing a package, its `dist` must be rebuilt (Turbo's `build.dependsOn: ["^build"]` handles this in `pnpm build`/`dev`). `dist` is gitignored; `packages/db/drizzle/` migrations are git-tracked.
- **Node libs use `NodeNext` + `verbatimModuleSyntax`.** In `packages/*` use explicit `.js` extensions in relative imports and `import type` for type-only imports.
- **`NODE_ENV` is pinned to `development` by the devcontainer.** This leaks into `next build` and breaks production prerender (React resolves to null → `useContext` crash on error pages). Next apps' `build`/`start` scripts must force `NODE_ENV=production` (web/admin already do). `next dev` is unaffected.
- **Env vars reach tasks only if declared.** Turbo runs in strict env mode; any env var a task needs at runtime must be in `turbo.json` `globalPassThroughEnv` (e.g. `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN`, `ADMIN_ORIGIN`, `API_PORT`). Use `API_PORT`, **not** `PORT` — `PORT` is also read by Next and collides with web. Real values go in root `.env` (gitignored; `.env.example` is the template), loaded by dotenv-cli in root scripts.

## Architecture: layering

Strict one-directional layering — keep each layer's concern out of the others:

`validators` (input rules) → `auth` (pure crypto/JWT, no HTTP/DB) → `db` (persistence) → `apps/api` (HTTP, cookies, CORS).

- **`db` hides Drizzle.** All DB access goes through `packages/db/src/queries/*` helpers (e.g. `getUserByEmail`, `createContact`); `apps/api` never imports `drizzle-orm` directly. Query helpers have explicit return types so Drizzle internals don't leak into published `.d.ts`.
- **Do not use drizzle-zod.** Input validation lives in `validators` (it owns length/format rules that DB `text()` columns can't express). Use Drizzle's `$inferInsert`/`$inferSelect` for DB-side types.
- **`auth` is generic over role.** JWT payload carries `role: "user" | "admin"`; a single `JWT_SECRET` signs both. The api distinguishes them, not `auth`.

## Architecture: authentication

Users and admins are **separate tables** (`users`/`admins`) with **separate refresh-token tables** and **separate cookies** (`access_token`/`refresh_token` vs `admin_access_token`/`admin_refresh_token`).

- Tokens ride in **HttpOnly cookies**, never response bodies. Access cookie is `Path=/` and lives the session window (30d) so the proxy gate sees it; the JWT inside is short-lived (15m) and renewed via refresh. Refresh cookie is scoped (`/auth`, `/admin/auth`).
- **Refresh rotation is single-use and atomic**: `revoke*RefreshToken` does a conditional `UPDATE ... WHERE revoked_at IS NULL ... RETURNING` and returns whether it won; the route only issues a new session if it did. Reusing an already-revoked token triggers a revoke-all (theft response).
- `apps/api/src/auth/`: `cookies.ts` (helpers), `middleware.ts` (`requireAuth`, `requireAdmin` — the latter requires `role === "admin"`), `user-routes.ts`, `admin-routes.ts`. Admin has no self-register; admins are seeded.
- Next frontends gate protected routes with `src/proxy.ts` (Next 16's successor to `middleware.ts`), checking cookie _presence_ only as a fast redirect; real validity is confirmed by calling the API (`/me`, `/admin/me`) with silent refresh on 401. The API is the actual authorization boundary.
- CORS uses an explicit allowlist (`WEB_ORIGIN`, `ADMIN_ORIGIN`) with `credentials: true` — `*` is not allowed with cookies.
