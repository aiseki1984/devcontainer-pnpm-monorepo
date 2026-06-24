"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore, type Admin } from "../lib/auth-store";

export type { Admin };

/**
 * 認証状態は zustand ストア（useAuthStore）が持つので Provider は状態を持たない。
 * 役割は初回マウントで /admin/me を一度だけ取りにいくこと（旧 Context 実装の useEffect 相当）。
 *
 * boilerplate として **あえて** web 側（apps/web）とは別の方式を見せている:
 * - admin（このアプリ）= zustand ストア（グローバル状態ライブラリを使うやり方）
 * - web = React Context + useState（追加ライブラリ不要の標準的なやり方）
 * どちらも useAuth() の外形は同じ。比較できるよう両方を残している（README 参照）。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const load = useAuthStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return <>{children}</>;
}

/**
 * 認証状態フック。外形は従来の Context 版と同じ（admin / loading / reload / logout）なので
 * 呼び出し側は変更不要。中身は zustand ストアを読むだけ（reload は store.load のエイリアス）。
 * 返り値の型はストアの状態から推論させ、別途の型宣言と二重管理しない。
 */
export function useAuth() {
  const admin = useAuthStore((s) => s.admin);
  const loading = useAuthStore((s) => s.loading);
  const reload = useAuthStore((s) => s.load);
  const logout = useAuthStore((s) => s.logout);
  return { admin, loading, reload, logout };
}
