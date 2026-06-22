import { NextResponse, type NextRequest } from "next/server";

/**
 * 保護ルートの入口ゲート（Next 16 の proxy 規約。旧 middleware の後継）。
 * access Cookie が無ければ /login へ飛ばす。
 * ここは「Cookie の有無」だけを高速に判定する一次フィルタで、
 * トークンの有効性（改ざん・期限）は保護ページ側が /me で確認する。
 *
 * 注: Cookie はポートでは分かれないので、api(:8787) が localhost に発行した
 * access_token はこの web(:3000) でも読める。
 */
export function proxy(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/mypage", "/mypage/:path*"],
};
