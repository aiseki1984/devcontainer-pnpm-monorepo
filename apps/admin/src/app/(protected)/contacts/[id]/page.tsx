import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adminApiGet } from "../../../../lib/server-api";

/** API（GET /admin/contacts/:id）が返すお問い合わせ1件分の形。db の Contact に対応。 */
type Contact = {
  id: number;
  name: string;
  email: string;
  title: string;
  message: string;
  createdAt: string;
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await adminApiGet(`/admin/contacts/${id}`);
  // JWT 切れ（access Cookie はあるが中身が期限切れ）→ 更新の単一経路へ。戻り先に現在の詳細を渡す。
  if (res.status === 401) {
    redirect(
      `/admin/auth/refresh?next=${encodeURIComponent(`/contacts/${id}`)}`,
    );
  }
  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    return (
      <section className="flex flex-col gap-4">
        <BackLink />
        <p className="text-sm text-red-600 dark:text-red-400">
          お問い合わせの取得に失敗しました。
        </p>
      </section>
    );
  }

  const { data: contact } = (await res.json()) as { data: Contact };

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <BackLink />

      <article className="flex flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <header className="flex flex-col gap-2 border-b border-black/[.06] pb-4 dark:border-white/[.1]">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight">
              {contact.title}
            </h1>
            <time className="shrink-0 text-xs text-zinc-500">
              {new Date(contact.createdAt).toLocaleString("ja-JP")}
            </time>
          </div>
          <p className="text-sm text-zinc-500">
            {contact.name}（{contact.email}）
          </p>
        </header>

        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {contact.message}
        </p>

        {/* 既読・削除などの操作ボタンは今後ここに追加する。 */}
      </article>
    </section>
  );
}

function BackLink() {
  return (
    <Link
      href="/contacts"
      className="text-sm text-zinc-500 transition-colors hover:text-foreground"
    >
      ← 一覧へ戻る
    </Link>
  );
}
