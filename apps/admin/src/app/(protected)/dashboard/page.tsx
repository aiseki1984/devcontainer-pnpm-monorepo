import { redirect } from "next/navigation";
import { adminApiGet } from "../../../lib/server-api";

type Me = { admin: { id: number; email: string; role: string } };

export default async function DashboardPage() {
  const res = await adminApiGet("/admin/me");
  if (res.status === 401) redirect("/admin/auth/refresh?next=/dashboard");
  if (!res.ok) redirect("/login");

  const { admin } = (await res.json()) as Me;

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
