import { API_URL } from "./api";

/**
 * クライアントコンポーネントから API を叩く POST（JSON ボディ + Cookie 同送）。
 *
 * 401 でもリダイレクトはしない（呼び出し側が res.ok を見てハンドリングする）。
 * ログインのような認証フォームでは 401＝認証失敗を画面にエラー表示したいので、
 * リダイレクトしないこの関数を使う。
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

/**
 * 認証済み前提のクライアント POST（例: セッション失効）。
 * 401（SSR 後に access が失効し silent refresh も通らない稀なケース）は
 * セッション終了とみなして /login へ寄せる。サーバ側の adminApiGet が
 * redirect("/login") するのと挙動を揃える。
 */
export async function adminApiPost(
  path: string,
  body?: unknown,
): Promise<Response> {
  const res = await apiPost(path, body);
  if (res.status === 401) {
    window.location.href = "/login";
  }
  return res;
}
