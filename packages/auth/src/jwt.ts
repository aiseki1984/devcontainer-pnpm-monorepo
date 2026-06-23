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

/** アクセストークンの有効期限（リフレッシュトークンで再発行する前提の短命）。 */
const ACCESS_TOKEN_TTL = "15m";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

/** アクセストークン（短命 JWT・HS256）を発行する。 */
export function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecretKey());
}

/** アクセストークンを検証して payload を返す。期限切れ・改ざんなら例外を投げる。 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey());
  return {
    sub: payload.sub ?? "",
    role: payload.role as Role,
    email: typeof payload.email === "string" ? payload.email : "",
  };
}
