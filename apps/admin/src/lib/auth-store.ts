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
 * load()/logout() の世代カウンタ。store は module-level シングルトンで、
 * 旧 Context のような mount/unmount 単位のクリーンアップが効かないため、
 * 「最後に開始した操作」だけが状態を確定できるようにして遅延解決のレースを防ぐ。
 * 例: 古い load() の fetch が遅れて解決しても、その後 login(=load) や logout が
 * 走っていれば結果を破棄する。
 */
let authGeneration = 0;

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
    const generation = ++authGeneration;
    set({ loading: true });
    const admin = await fetchAdmin().catch(() => null);
    // 自分より後に load/logout が始まっていたら、古い結果で上書きしない。
    if (generation !== authGeneration) return;
    set({ admin, loading: false });
  },
  logout: async () => {
    // 進行中の load があってもログアウトを上書きさせない。
    authGeneration++;
    await fetch(`${API_URL}/admin/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    set({ admin: null, loading: false });
  },
}));
