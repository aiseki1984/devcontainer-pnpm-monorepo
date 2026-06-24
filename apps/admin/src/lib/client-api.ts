import { API_URL } from "./api";

/**
 * クライアントコンポーネントから API を叩く認証付き POST。
 * Cookie（HttpOnly な admin access/refresh）を載せるため credentials:"include" を付ける。
 *
 * 401（SSR 後に access が失効し silent refresh も通らない稀なケース）は
 * セッション終了とみなして /login へ寄せる。サーバ側の adminApiGet が
 * redirect("/login") するのと挙動を揃える（各コンポーネントで個別に 401 を捌かない）。
 */
export async function adminApiPost(path: string): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
  });
  if (res.status === 401) {
    window.location.href = "/login";
  }
  return res;
}
