import { SignJWT, jwtVerify } from "jose";

/** トークン主体の種別。users / admins は別テーブルだが JWT は共通ロジックで扱う。 */
export type Role = "user" | "admin";

/** アクセストークンに載せる情報。 */
export interface AccessTokenPayload {
  /** users / admins の id（文字列）。JWT の sub に入る。 */
  sub: string;
  role: Role;
  email: string;
}

export interface VerifyAccessTokenOptions {
  audience?: Role;
}

/** アクセストークンの有効期限（リフレッシュトークンで再発行する前提の短命）。 */
const ACCESS_TOKEN_TTL = "15m";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

function isRole(value: unknown): value is Role {
  return value === "user" || value === "admin";
}

/** アクセストークン（短命 JWT・HS256）を発行する。 */
export function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setAudience(payload.role)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecretKey());
}

/** アクセストークンを検証して payload を返す。期限切れ・改ざんなら例外を投げる。 */
export async function verifyAccessToken(
  token: string,
  options: VerifyAccessTokenOptions = {},
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: ["HS256"],
    audience: options.audience,
  });
  if (typeof payload.sub !== "string") {
    throw new Error("invalid token subject");
  }
  if (!isRole(payload.role)) {
    throw new Error("invalid token role");
  }
  if (options.audience && payload.role !== options.audience) {
    throw new Error("token role does not match audience");
  }
  if (typeof payload.email !== "string") {
    throw new Error("invalid token email");
  }
  return {
    sub: payload.sub,
    role: payload.role,
    email: payload.email,
  };
}
