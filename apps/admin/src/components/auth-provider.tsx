"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore, type Admin } from "../lib/auth-store";

export type { Admin };

type AuthContextValue = {
  admin: Admin | null;
  loading: boolean;
  /** ログイン後に呼んで状態を取り直す。 */
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};

/**
 * 認証状態は zustand ストア（useAuthStore）が持つので Provider は状態を持たない。
 * 役割は初回マウントで /admin/me を一度だけ取りにいくこと（旧 Context 実装の useEffect 相当）。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const load = useAuthStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return <>{children}</>;
}

/**
 * 認証状態フック。外形は従来の Context 版と同じ（admin/loading/reload/logout）なので
 * 呼び出し側は変更不要。中身は zustand ストアを読むだけ。
 */
export function useAuth(): AuthContextValue {
  const admin = useAuthStore((s) => s.admin);
  const loading = useAuthStore((s) => s.loading);
  const reload = useAuthStore((s) => s.load);
  const logout = useAuthStore((s) => s.logout);
  return { admin, loading, reload, logout };
}
