import { redirect } from "next/navigation";
import { userApiGet } from "../../lib/server-api";

type Me = { user: { id: number; email: string; role: string } };

export default async function MyPage() {
  const res = await userApiGet("/me");
  // JWT 切れ（access Cookie はあるが中身が期限切れ）→ 更新の単一経路へ。
  if (res.status === 401) redirect("/auth/refresh?next=/mypage");
  if (!res.ok) redirect("/login");

  const { user } = (await res.json()) as Me;

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <section className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">id</dt>
            <dd>{user.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">role</dt>
            <dd>{user.role}</dd>
          </div>
        </dl>
        <p className="text-sm text-zinc-500">
          ログアウトは右上のメニューから。
        </p>
      </section>
    </main>
  );
}
