import { Hono, type Context, type MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { loginSchema } from "@pnpm-test-workspace/validators";
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
  responseKey: "user" | "admin";
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

function publicAccount<TAccount extends Account>(
  account: TAccount,
  role: Role,
) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role,
  };
}

function jsonPayload(responseKey: "user" | "admin", account: unknown) {
  return responseKey === "admin"
    ? { ok: true, admin: account }
    : { ok: true, user: account };
}

export function createAuthRoutes<
  TAccount extends Account,
  TRefresh extends RefreshTokenRow,
>(config: AuthRouteConfig<TAccount, TRefresh>) {
  const routes = new Hono<{ Variables: AuthVariables }>();

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
    return c.json(
      jsonPayload(config.responseKey, publicAccount(account, config.role)),
    );
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
      return c.json(
        { ok: false, error: `${config.responseKey} not found` },
        401,
      );
    }
    const rotated = await config.revokeRefreshToken(row.id);
    if (!rotated) {
      config.clearCookies(c);
      return c.json({ ok: false, error: "refresh token already used" }, 401);
    }
    await issueSession(c, account);
    return c.json(
      jsonPayload(config.responseKey, publicAccount(account, config.role)),
    );
  });

  routes.get(config.mePath, config.requireRole, async (c) => {
    const payload = c.get("user");
    const account = await config.getById(Number(payload.sub));
    if (!account) {
      return c.json(
        { ok: false, error: `${config.responseKey} not found` },
        401,
      );
    }
    return c.json(
      jsonPayload(config.responseKey, publicAccount(account, config.role)),
    );
  });

  return {
    routes,
    issueSession,
    publicAccount: (account: TAccount) => publicAccount(account, config.role),
  };
}
