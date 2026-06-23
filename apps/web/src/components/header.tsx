"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/contact", label: "お問い合わせ" },
  { href: "/mypage", label: "マイページ" },
];

export function Header() {
  const router = useRouter();
  const { me, loading, logout } = useAuth();

  async function onLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-black/[.08] bg-white/80 backdrop-blur dark:border-white/[.145] dark:bg-black/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className="font-semibold tracking-tight">
            MyApp
          </Link>
          {navLinks.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          {loading ? null : me ? (
            <>
              <span className="text-zinc-500">{me.email}</span>
              <button
                onClick={onLogout}
                className="rounded-full border border-black/[.12] px-3 py-1 transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.06]"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="font-medium hover:underline">
                ログイン
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-foreground px-3 py-1 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
