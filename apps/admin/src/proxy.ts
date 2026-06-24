import { NextResponse, type NextRequest } from "next/server";

/** JWT の exp（秒）をデコードし、スキュー込みで「期限切れ間近」かを判定する。 */
const SKEW_MS = 30_000;

/**
 * access JWT の exp を見て期限切れ（間近含む）かを返す。署名検証はしない
 * （リフレッシュすべきかの軽い事前判定。本物の検証は API 側の requireAdmin が行う）。
 * デコード不能なら true（壊れている → refresh で自己修復 or /login）。Edge 実行のため atob/TextDecoder を使う。
 */
function isAccessTokenExpired(token: string): boolean {
  try {
    const part = token.split(".")[1];
    if (!part) return true;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bytes = Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
    const { exp } = JSON.parse(new TextDecoder().decode(bytes)) as {
      exp?: number;
    };
    if (typeof exp !== "number") return true;
    return exp * 1000 <= Date.now() + SKEW_MS;
  } catch {
    return true;
  }
}

/**
 * 管理画面の保護ルートの入口ゲート（Next 16 の proxy 規約）。
 * 1) access Cookie が無ければ /login（セッションが無い）。
 * 2) access JWT が期限切れ間近なら、描画前に refresh の単一経路へ飛ばす
 *    （ページ側で 401 を踏んでから redirect する重複をここに集約）。
 *    refresh の実体は /admin/auth/refresh のルートハンドラ（refresh Cookie の Path に整合）。
 * 3) それ以外は通す。トークンの本検証（署名・role）は API 側が担う。
 */
export function proxy(req: NextRequest) {
  const token = req.cookies.get("admin_access_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAccessTokenExpired(token)) {
    const next = req.nextUrl.pathname + req.nextUrl.search;
    const url = new URL("/admin/auth/refresh", req.url);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/contacts",
    "/contacts/:path*",
    "/users",
    "/users/:path*",
  ],
};
