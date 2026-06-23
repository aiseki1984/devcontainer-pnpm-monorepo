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

export type Me = { id: number; email: string; role: string };

type AuthContextValue = {
  me: Me | null;
  loading: boolean;
  /** ログイン/登録後に呼んで状態を取り直す。 */
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * /me を取得し、401 なら一度だけ /auth/refresh を試す純粋関数（setState は持たない）。
 * 認証取得を 1 箇所に集約し、ヘッダーとページが別々に refresh して競合するのを防ぐ。
 */
async function fetchMe(): Promise<Me | null> {
  let res = await fetch(`${API_URL}/me`, { credentials: "include" });
  if (res.status === 401) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) {
      res = await fetch(`${API_URL}/me`, { credentials: "include" });
    }
  }
  return res.ok ? ((await res.json()).user as Me) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const next = await fetchMe().catch(() => null);
    setMe(next);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setMe(null);
  }, []);

  useEffect(() => {
    let active = true;
    fetchMe()
      .then((next) => {
        if (active) {
          setMe(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setMe(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, reload, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
