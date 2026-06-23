type SessionOptions<T> = {
  mePath: string;
  refreshPath: string;
  select: (body: unknown) => T;
};

/**
 * 現在セッションを取得し、401 なら一度だけ refresh して取り直す。
 * AuthProvider 側に refresh の分岐を持たせず、認証状態取得の流れを 1 箇所に閉じる。
 */
export async function fetchSession<T>({
  mePath,
  refreshPath,
  select,
}: SessionOptions<T>): Promise<T | null> {
  let res = await fetch(mePath, { credentials: "include" });
  if (res.status === 401) {
    const refreshed = await fetch(refreshPath, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) {
      res = await fetch(mePath, { credentials: "include" });
    }
  }
  return res.ok ? select(await res.json()) : null;
}
