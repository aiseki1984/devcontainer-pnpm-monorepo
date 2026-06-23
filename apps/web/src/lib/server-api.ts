import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL } from "./api";

/**
 * サーバコンポーネントから API を叩く GET。
 * ブラウザが送ってきた Cookie（HttpOnly な access/refresh）をそのまま API へ転送する。
 *
 * 期限切れの事前リフレッシュは proxy が担う（描画前に /auth/refresh へ集約）。
 * proxy 通過後にここで 401 になるのは署名不正・サーバ失効など稀なケースだけなので、
 * セッション終了とみなして /login へ寄せる（ページ側で 401 を個別に捌かない）。
 * 注: redirect() は内部で例外を投げるので、呼び出し側で try/catch しないこと。
 */
export async function userApiGet(path: string): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (res.status === 401) redirect("/login");
  return res;
}
