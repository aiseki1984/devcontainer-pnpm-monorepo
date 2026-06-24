import { create } from "zustand";
import { API_URL } from "./api";
import { fetchSession } from "./session";

export type Admin = { id: number; email: string; name: string; role: string };

type AuthState = {
  admin: Admin | null;
  loading: boolean;
  /** /admin/me を取得して状態を反映する（初回マウント時とログイン後に呼ぶ）。 */
  load: () => Promise<void>;
  logout: () => Promise<void>;
};

/**
 * /admin/me を取得し、401 なら一度だけ /admin/auth/refresh を試す。
 * 認証取得を 1 箇所に集約し、サイドバーとページが別々に refresh して競合するのを防ぐ。
 */
function fetchAdmin(): Promise<Admin | null> {
  return fetchSession({
    mePath: `${API_URL}/admin/me`,
    refreshPath: `${API_URL}/admin/auth/refresh`,
    select: (body) => (body as { admin: Admin }).admin,
  });
}

/**
 * 認証状態（現在の admin と読み込み状態）のグローバルストア。
 * React Context の代わりに zustand を使うクライアント状態の例。
 *
 * 注: トークンは HttpOnly Cookie に置いたままで、ここには載せない。
 * ストアが持つのは「今ログインしている admin は誰か」という表示用の状態だけ
 * （サーバー状態のキャッシュではない）。
 */
export const useAuthStore = create<AuthState>((set) => ({
  admin: null,
  loading: true,
  load: async () => {
    const admin = await fetchAdmin().catch(() => null);
    set({ admin, loading: false });
  },
  logout: async () => {
    await fetch(`${API_URL}/admin/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    set({ admin: null });
  },
}));
