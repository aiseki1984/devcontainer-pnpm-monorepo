import { cookies } from "next/headers";
import { API_URL } from "./api";

/**
 * サーバコンポーネントから API を叩く GET。
 * ブラウザが送ってきた Cookie（HttpOnly な access/refresh）をそのまま API へ転送する。
 * 認証の更新はここでは行わず、401 はページ側が /auth/refresh ルートに委ねる（更新経路を 1 つに保つ）。
 */
export async function adminApiGet(path: string): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  return fetch(`${API_URL}${path}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
}
