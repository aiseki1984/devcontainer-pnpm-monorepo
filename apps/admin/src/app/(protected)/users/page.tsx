import Link from "next/link";
import { redirect } from "next/navigation";
import { adminApiGet } from "../../../lib/server-api";
import { Pagination } from "../../../components/pagination";
import { formatDateTime } from "../../../lib/format";

/** API（GET /admin/users）が返すユーザー1件分の形。db の UserListRow に対応。 */
type User = {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  activeSessionCount: number;
};

type UsersResponse = {
  data: User[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

const PER_PAGE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // 認証は proxy（期限切れ→refresh）と adminApiGet（401→/login）が担うので、ここは認証を気にしない。
  const res = await adminApiGet(
    `/admin/users?page=${page}&perPage=${PER_PAGE}`,
  );
  if (!res.ok) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">ユーザー</h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          ユーザーの取得に失敗しました。
        </p>
      </section>
    );
  }

  const { data, pagination } = (await res.json()) as UsersResponse;
  const hasUsers = pagination.total > 0;
  const isOutOfRange = hasUsers && pagination.page > pagination.totalPages;
  const isPageEmpty = hasUsers && data.length === 0;

  if (isOutOfRange) {
    redirect(`/users?page=${pagination.totalPages}`);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">ユーザー</h1>
        <span className="text-sm text-zinc-500">全 {pagination.total} 件</span>
      </div>

      {!hasUsers ? (
        <p className="text-sm text-zinc-500">ユーザーはまだいません。</p>
      ) : isPageEmpty ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500">
            このページに該当するユーザーはいません。
          </p>
          <Link
            href="/users"
            className="w-fit rounded-md border border-black/[.12] px-3 py-1.5 text-sm transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:hover:bg-white/[.06]"
          >
            1 ページ目へ戻る
          </Link>
        </div>
      ) : (
        <>
          <Pagination
            basePath="/users"
            page={pagination.page}
            totalPages={pagination.totalPages}
          />

          <ul className="flex flex-col gap-3">
            {data.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/users/${user.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-black/[.08] bg-white p-5 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.04]"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-medium">{user.name}</h2>
                    <time className="shrink-0 text-xs text-zinc-500">
                      {formatDateTime(user.createdAt)}
                    </time>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-zinc-500">{user.email}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        user.activeSessionCount > 0
                          ? "bg-emerald-500/[.12] text-emerald-700 dark:text-emerald-400"
                          : "bg-black/[.04] text-zinc-500 dark:bg-white/[.06]"
                      }`}
                    >
                      アクティブ {user.activeSessionCount}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            basePath="/users"
            page={pagination.page}
            totalPages={pagination.totalPages}
          />
        </>
      )}
    </section>
  );
}
