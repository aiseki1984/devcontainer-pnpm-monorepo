import Link from "next/link";
import { adminApiGet } from "../../../lib/server-api";
import { Pagination } from "../../../components/pagination";

/** API（GET /admin/contacts）が返すお問い合わせ1件分の形。db の Contact に対応。 */
type Contact = {
  id: number;
  name: string;
  email: string;
  title: string;
  message: string;
  createdAt: string;
};

type ContactsResponse = {
  data: Contact[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

const PER_PAGE = 20;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // 認証は proxy（期限切れ→refresh）と adminApiGet（401→/login）が担うので、ここは認証を気にしない。
  const res = await adminApiGet(
    `/admin/contacts?page=${page}&perPage=${PER_PAGE}`,
  );
  if (!res.ok) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">お問い合わせ</h1>
        <p className="text-sm text-red-600 dark:text-red-400">
          お問い合わせの取得に失敗しました。
        </p>
      </section>
    );
  }

  const { data, pagination } = (await res.json()) as ContactsResponse;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">お問い合わせ</h1>
        <span className="text-sm text-zinc-500">全 {pagination.total} 件</span>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-zinc-500">お問い合わせはまだありません。</p>
      ) : (
        <>
          <Pagination
            basePath="/contacts"
            page={pagination.page}
            totalPages={pagination.totalPages}
          />

          <ul className="flex flex-col gap-3">
            {data.map((contact) => (
              <li key={contact.id}>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-black/[.08] bg-white p-5 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.04]"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-medium">{contact.title}</h2>
                    <time className="shrink-0 text-xs text-zinc-500">
                      {new Date(contact.createdAt).toLocaleString("ja-JP")}
                    </time>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {contact.name}（{contact.email}）
                  </p>
                  <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {contact.message}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            basePath="/contacts"
            page={pagination.page}
            totalPages={pagination.totalPages}
          />
        </>
      )}
    </section>
  );
}
