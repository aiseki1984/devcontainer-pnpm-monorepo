/**
 * api のベース URL。ブラウザから直接叩くため NEXT_PUBLIC_ で公開する。
 * 未設定時は dev の既定ポート（apps/api の API_PORT=8787）にフォールバックする。
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * 認証付き fetch。401 なら一度だけ /admin/auth/refresh を試してから再送する（silent refresh）。
 * Cookie は HttpOnly なので credentials:"include" を常に付ける。
 */
export async function adminFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: "include" };
  let res = await fetch(`${API_URL}${path}`, opts);
  if (res.status === 401) {
    const refreshed = await fetch(`${API_URL}/admin/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) {
      res = await fetch(`${API_URL}${path}`, opts);
    }
  }
  return res;
}
