import { API_URL } from "./api";

/**
 * クライアントコンポーネントから API を叩く POST（JSON ボディ + Cookie 同送）。
 *
 * 401 でもリダイレクトはしない（呼び出し側が res.ok を見てハンドリングする）。
 * ログイン/登録のような認証フォームでは 401＝認証失敗を画面にエラー表示したいので、
 * 「セッション切れ→/login へ」のリダイレクトは行わない。
 */
export async function apiPost(path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
