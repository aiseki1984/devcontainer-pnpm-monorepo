"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib/api";

type Admin = { id: number; email: string; role: string };

export default function DashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);

  // access Cookie の有無は proxy が弾くが、トークンの有効性は /admin/me で確認する。
  // access JWT が切れていても（401）、refresh で一度だけ再発行を試みてから判定する。
  useEffect(() => {
    let active = true;

    async function fetchMe(): Promise<Response> {
      const res = await fetch(`${API_URL}/admin/me`, {
        credentials: "include",
      });
      if (res.status !== 401) return res;
      const refreshed = await fetch(`${API_URL}/admin/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!refreshed.ok) return res;
      return fetch(`${API_URL}/admin/me`, { credentials: "include" });
    }

    fetchMe()
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthorized");
        const data = (await res.json()) as { admin: Admin };
        if (active) setAdmin(data.admin);
      })
      .catch(() => {
        router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function logout() {
    await fetch(`${API_URL}/admin/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.replace("/login");
    router.refresh();
  }

  if (!admin) {
    return (
      <main className="flex flex-1 items-center justify-center text-zinc-500">
        読み込み中…
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <section className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">
          管理ダッシュボード
        </h1>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">id</dt>
            <dd>{admin.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">email</dt>
            <dd>{admin.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">role</dt>
            <dd>{admin.role}</dd>
          </div>
        </dl>
        <button
          onClick={logout}
          className="mt-2 h-11 rounded-full border border-black/[.12] font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.06]"
        >
          ログアウト
        </button>
      </section>
    </main>
  );
}
