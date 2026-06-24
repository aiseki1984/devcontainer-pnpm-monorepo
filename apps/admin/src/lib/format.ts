/**
 * 表示用の日時フォーマッタ。timeZone を明示的に固定するのが要点。
 *
 * - timeZone を省くと実行環境の TZ で整形され、SSR(コンテナ=UTC) と
 *   ブラウザ(ローカル) で文字列がズレて hydration mismatch になる。
 * - サーバ側で整形して文字列を渡す場合も、TZ を固定しないと閲覧者の地域に依らず
 *   サーバの TZ(UTC) 表示になる。
 *
 * このboilerplateは日本向けなので Asia/Tokyo を既定にしている。
 * 別地域向けに使う場合はここを変える（将来は env / ユーザー設定で可変にしてもよい）。
 */
const DISPLAY_TIME_ZONE = "Asia/Tokyo";

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: DISPLAY_TIME_ZONE,
  });
}
