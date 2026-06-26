import { Hono, type Context, type MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { loginSchema } from "@pnpm-test-workspace/validators";
import { publicObjectUrl } from "@pnpm-test-workspace/storage";
import {
  DUMMY_PASSWORD_HASH,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  type Role,
  verifyPassword,
} from "@pnpm-test-workspace/auth";
import { REFRESH_MAX_AGE_MS } from "./cookies.js";
import type { AuthVariables } from "./middleware.js";

type Account = {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  // user アカウントのみ持つ（admin は列自体が無い）。公開形に出すかは
  // 実行時にプロパティの有無で判定し、admin レスポンスには載せない。
  avatarKey?: string | null;
};

type RefreshTokenRow = {
  id: number;
  expiresAt: Date;
  revokedAt: Date | null;
};

type AuthRouteConfig<
  TAccount extends Account,
  TRefresh extends RefreshTokenRow,
> = {
  role: Role;
  loginPath: string;
  logoutPath: string;
  refreshPath: string;
  mePath: string;
  refreshCookie: string;
  getByEmail: (email: string) => Promise<TAccount | null>;
  getById: (id: number) => Promise<TAccount | null>;
  createRefreshToken: (input: {
    accountId: number;
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<unknown>;
  findRefreshTokenByHash: (tokenHash: string) => Promise<TRefresh | null>;
  getRefreshAccountId: (row: TRefresh) => number;
  revokeRefreshToken: (id: number) => Promise<boolean>;
  revokeAllRefreshTokens: (accountId: number) => Promise<void>;
  setAccessCookie: (c: Context, token: string) => void;
  setRefreshCookie: (c: Context, token: string) => void;
  clearCookies: (c: Context) => void;
  requireRole: MiddlewareHandler<{ Variables: AuthVariables }>;
};

export function createAuthRoutes<
  TAccount extends Account,
  TRefresh extends RefreshTokenRow,
>(config: AuthRouteConfig<TAccount, TRefresh>) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  // publicAccount は passwordHash 等の秘匿列を見ないので、必要な列だけの構造的な型を受ける。
  // これにより full な account 行だけでなく、PublicUser のような射影済みの形（PATCH /me が
  // updateUserAvatar から受け取る形）も同じ整形関数に通せる。
  function publicAccount(account: {
    id: number;
    email: string;
    name: string;
    avatarKey?: string | null;
  }) {
    const base = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: config.role,
    };
    // avatarKey は user アカウントだけが持つ。role で分岐し admin レスポンスには載せない
    // （プロパティの有無に依存すると、user 側クエリの射影変更で黙って欠落しうるため）。
    // avatar は公開バケット配信なので、key から公開固定 URL を導出して一緒に返す
    // （コメント機能等で他ユーザーの avatar も同じ形で表示できる）。
    if (config.role !== "user") {
      return base;
    }
    const avatarKey = account.avatarKey ?? null;
    return {
      ...base,
      avatarKey,
      avatarUrl: avatarKey ? publicObjectUrl(avatarKey) : null,
    };
  }

  function sessionResponse(account: TAccount) {
    return config.role === "admin"
      ? { ok: true, admin: publicAccount(account) }
      : { ok: true, user: publicAccount(account) };
  }

  async function issueSession(c: Context, account: TAccount): Promise<void> {
    const accessToken = await signAccessToken({
      sub: String(account.id),
      role: config.role,
      email: account.email,
    });
    const { token, tokenHash } = generateRefreshToken();
    await config.createRefreshToken({
      accountId: account.id,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS),
    });
    config.setAccessCookie(c, accessToken);
    config.setRefreshCookie(c, token);
  }

  routes.post(config.loginPath, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid JSON" }, 400);
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors },
        400,
      );
    }
    const account = await config.getByEmail(parsed.data.email);
    const passwordMatches = await verifyPassword(
      account?.passwordHash ?? DUMMY_PASSWORD_HASH,
      parsed.data.password,
    );
    if (!account || !passwordMatches) {
      return c.json({ ok: false, error: "invalid email or password" }, 401);
    }
    await issueSession(c, account);
    return c.json(sessionResponse(account));
  });

  routes.post(config.logoutPath, async (c) => {
    const raw = getCookie(c, config.refreshCookie);
    if (raw) {
      const row = await config.findRefreshTokenByHash(hashRefreshToken(raw));
      if (row) {
        await config.revokeRefreshToken(row.id);
      }
    }
    config.clearCookies(c);
    return c.json({ ok: true });
  });

  routes.post(config.refreshPath, async (c) => {
    const raw = getCookie(c, config.refreshCookie);
    if (!raw) {
      return c.json({ ok: false, error: "no refresh token" }, 401);
    }
    const row = await config.findRefreshTokenByHash(hashRefreshToken(raw));
    if (!row) {
      config.clearCookies(c);
      return c.json({ ok: false, error: "invalid refresh token" }, 401);
    }
    const accountId = config.getRefreshAccountId(row);
    if (row.revokedAt) {
      await config.revokeAllRefreshTokens(accountId);
      config.clearCookies(c);
      return c.json({ ok: false, error: "refresh token reuse detected" }, 401);
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await config.revokeRefreshToken(row.id);
      config.clearCookies(c);
      return c.json({ ok: false, error: "refresh token expired" }, 401);
    }
    const account = await config.getById(accountId);
    if (!account) {
      config.clearCookies(c);
      return c.json({ ok: false, error: `${config.role} not found` }, 401);
    }
    const rotated = await config.revokeRefreshToken(row.id);
    if (!rotated) {
      config.clearCookies(c);
      return c.json({ ok: false, error: "refresh token already used" }, 401);
    }
    await issueSession(c, account);
    return c.json(sessionResponse(account));
  });

  routes.get(config.mePath, config.requireRole, async (c) => {
    const payload = c.get("user");
    const account = await config.getById(Number(payload.sub));
    if (!account) {
      return c.json({ ok: false, error: `${config.role} not found` }, 401);
    }
    return c.json(sessionResponse(account));
  });

  return {
    routes,
    issueSession,
    publicAccount,
  };
}
