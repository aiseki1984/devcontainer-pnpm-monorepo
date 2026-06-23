"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { API_URL } from "../lib/api";

export type Admin = { id: number; email: string; role: string };

type AuthContextValue = {
  admin: Admin | null;
  loading: boolean;
  /** ログイン後に呼んで状態を取り直す。 */
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * /admin/me を取得し、401 なら一度だけ /admin/auth/refresh を試す純粋関数。
 * 認証取得を 1 箇所に集約し、サイドバーとページが別々に refresh して競合するのを防ぐ。
 */
async function fetchAdmin(): Promise<Admin | null> {
  let res = await fetch(`${API_URL}/admin/me`, { credentials: "include" });
  if (res.status === 401) {
    const refreshed = await fetch(`${API_URL}/admin/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) {
      res = await fetch(`${API_URL}/admin/me`, { credentials: "include" });
    }
  }
  return res.ok ? ((await res.json()).admin as Admin) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const next = await fetchAdmin().catch(() => null);
    setAdmin(next);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_URL}/admin/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setAdmin(null);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdmin()
      .then((next) => {
        if (active) {
          setAdmin(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setAdmin(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, reload, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
