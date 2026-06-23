"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-provider";

export default function MyPage() {
  const router = useRouter();
  const { me, loading } = useAuth();

  // proxy は access Cookie の有無で弾くが、無効トークン等で me が取れない場合は /login へ。
  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (loading || !me) {
    return (
      <main className="flex flex-1 items-center justify-center text-zinc-500">
        読み込み中…
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <section className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">id</dt>
            <dd>{me.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">email</dt>
            <dd>{me.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">role</dt>
            <dd>{me.role}</dd>
          </div>
        </dl>
        <p className="text-sm text-zinc-500">
          ログアウトは右上のメニューから。
        </p>
      </section>
    </main>
  );
}
