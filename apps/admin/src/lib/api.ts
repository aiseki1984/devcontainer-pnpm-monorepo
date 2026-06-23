/**
 * api のベース URL。ブラウザから直接叩くため NEXT_PUBLIC_ で公開する。
 * 未設定時は dev の既定ポート（apps/api の API_PORT=8787）にフォールバックする。
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
