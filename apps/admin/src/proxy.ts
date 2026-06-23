import { NextResponse, type NextRequest } from "next/server";

/**
 * 管理画面の保護ルートの入口ゲート（Next 16 の proxy 規約）。
 * admin の access Cookie が無ければ /login へ飛ばす一次フィルタ。
 * トークンの有効性（改ざん・期限・role）は保護ページ側が /admin/me で確認する。
 *
 * Cookie 名は user 側（access_token）と分けてあるので取り違えない。
 */
export function proxy(req: NextRequest) {
  const token = req.cookies.get("admin_access_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/contacts", "/contacts/:path*"],
};
