import { API_URL } from "./api";

/**
 * クライアントコンポーネントから API を叩く共通 fetch（Cookie 同送）。
 *
 * いずれも 401 でもリダイレクトはしない（呼び出し側が res.ok を見てハンドリングする）。
 * ログイン/登録のような認証フォームでは 401＝認証失敗を画面にエラー表示したいので、
 * 「セッション切れ→/login へ」のリダイレクトは行わない。保護ページの読み取りで
 * 401 を /login に寄せたい場合はサーバ側の userApiGet を使う。
 */
function apiSend(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** JSON ボディ付き POST。 */
export function apiPost(path: string, body?: unknown): Promise<Response> {
  return apiSend("POST", path, body);
}

/** JSON ボディ付き PATCH。 */
export function apiPatch(path: string, body?: unknown): Promise<Response> {
  return apiSend("PATCH", path, body);
}

/** Cookie 同送の GET。 */
export function apiGet(path: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, { credentials: "include" });
}

/** Cookie 同送の DELETE。 */
export function apiDelete(path: string): Promise<Response> {
  return apiSend("DELETE", path);
}
