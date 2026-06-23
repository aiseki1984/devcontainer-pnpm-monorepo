"use client";

import { useAuth } from "../../../components/auth-provider";

export default function DashboardPage() {
  // SidebarShell が admin の存在を保証してから描画する。
  const { admin } = useAuth();
  if (!admin) return null;

  return (
    <section className="flex max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold tracking-tight">
        管理ダッシュボード
      </h1>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-8">
          <dt className="text-zinc-500">id</dt>
          <dd>{admin.id}</dd>
        </div>
        <div className="flex justify-between gap-8">
          <dt className="text-zinc-500">email</dt>
          <dd>{admin.email}</dd>
        </div>
        <div className="flex justify-between gap-8">
          <dt className="text-zinc-500">role</dt>
          <dd>{admin.role}</dd>
        </div>
      </dl>
    </section>
  );
}
