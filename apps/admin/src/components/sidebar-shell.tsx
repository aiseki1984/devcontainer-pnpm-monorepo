"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-provider";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/users", label: "ユーザー" },
  { href: "/contacts", label: "お問い合わせ" },
];

/**
 * 保護ページ共通のシェル（サイドバー + トップバー）。
 * 本体は SSR でサーバ側が認証を確認して描画するので、ここはシェル（chrome）を即時描画する。
 * 念のためクライアントでも admin が取れなければ /login へ（保険のソフトゲート）。
 */
export function SidebarShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !admin) router.replace("/login");
  }, [loading, admin, router]);

  async function onLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-black/[.08] bg-zinc-50 dark:border-white/[.145] dark:bg-zinc-950">
        <div className="px-5 py-4 text-lg font-semibold tracking-tight">
          管理画面
        </div>
        <nav className="flex flex-col gap-1 px-2 text-sm">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 transition-colors ${
                  active
                    ? "bg-black/[.06] font-medium dark:bg-white/[.1]"
                    : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-black/[.08] px-6 text-sm dark:border-white/[.145]">
          <span className="text-zinc-500">{admin?.email ?? ""}</span>
          <button
            onClick={onLogout}
            className="rounded-full border border-black/[.12] px-3 py-1 transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.06]"
          >
            ログアウト
          </button>
        </header>
        <main className="flex flex-1 flex-col p-6">{children}</main>
      </div>
    </div>
  );
}
