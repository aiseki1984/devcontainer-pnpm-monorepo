import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "../../../../lib/api";

/**
 * SSR 中に 401 になった保護ページがリダイレクトしてくる、セッション更新の単一経路。
 * ここだけがリフレッシュトークンをローテーションするので、クライアント側の更新と二重に走って
 * 盗難検知（reuse 扱い）を誤爆させることがない。SSR 完了時＝クライアント mount 前に発火する。
 *
 * パスを /admin/auth/refresh にしているのは、admin_refresh_token の Cookie が
 * Path=/admin/auth に絞られているため。これに一致しないとブラウザが refresh Cookie を送らない。
 */
export async function GET(req: NextRequest) {
  // オープンリダイレクト防止: 内部の絶対パス（"/foo"）だけ許可する。
  const raw = req.nextUrl.searchParams.get("next");
  const next =
    raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  const cookieHeader = (await cookies()).toString();
  const refreshed = await fetch(`${API_URL}/admin/auth/refresh`, {
    method: "POST",
    headers: { cookie: cookieHeader },
  });
  if (!refreshed.ok) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ローテーション後の新しい Cookie をブラウザへ中継してから、元のページへ戻す。
  const res = NextResponse.redirect(new URL(next, req.url));
  for (const setCookie of refreshed.headers.getSetCookie()) {
    res.headers.append("set-cookie", setCookie);
  }
  return res;
}
