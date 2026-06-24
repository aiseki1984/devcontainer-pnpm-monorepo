import Link from "next/link";
import { notFound } from "next/navigation";
import { adminApiGet } from "../../../../lib/server-api";
import {
  SessionActions,
  type Session,
} from "../../../../components/session-actions";

/** API（GET /admin/users/:id）が返すユーザー1件分の形。 */
type User = {
  id: number;
  email: string;
  name: string;
  createdAt: string;
};

/** API（GET /admin/users/:id/sessions）が返す生のセッション形（日時は ISO 文字列）。 */
type ApiSession = {
  id: number;
  createdAt: string;
  expiresAt: string;
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 認証は proxy（期限切れ→refresh）と adminApiGet（401→/login）が担う。ここは 404 だけ捌く。
  const [userRes, sessionsRes] = await Promise.all([
    adminApiGet(`/admin/users/${id}`),
    adminApiGet(`/admin/users/${id}/sessions`),
  ]);

  if (userRes.status === 404) {
    notFound();
  }
  if (!userRes.ok || !sessionsRes.ok) {
    return (
      <section className="flex flex-col gap-4">
        <BackLink />
        <p className="text-sm text-red-600 dark:text-red-400">
          ユーザーの取得に失敗しました。
        </p>
      </section>
    );
  }

  const { data: user } = (await userRes.json()) as { data: User };
  const { data: apiSessions } = (await sessionsRes.json()) as {
    data: ApiSession[];
  };

  // 日時の整形はサーバー側で済ませ、整形済み文字列を client component に渡す
  // （client 側で toLocaleString すると SSR/hydration でタイムゾーンがズレる）。
  const sessions: Session[] = apiSessions.map((s) => ({
    id: s.id,
    createdAtLabel: new Date(s.createdAt).toLocaleString("ja-JP"),
    expiresAtLabel: new Date(s.expiresAt).toLocaleString("ja-JP"),
  }));

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <BackLink />

      <article className="flex flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <header className="flex flex-col gap-2 border-b border-black/[.06] pb-4 dark:border-white/[.1]">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight">
              {user.name}
            </h1>
            <time className="shrink-0 text-xs text-zinc-500">
              登録: {new Date(user.createdAt).toLocaleString("ja-JP")}
            </time>
          </div>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </header>

        <SessionActions userId={user.id} sessions={sessions} />

        <p className="rounded-lg border border-amber-500/30 bg-amber-500/[.06] px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
          失効はステートレス方式（モデルA）。失効すると新しいアクセストークンを
          取り直せなくなりますが、発行済みのアクセストークン（有効 15
          分）が切れるまでは即座にはログアウトされません。次回の自動更新が 401
          になった時点でログイン画面へ戻ります。
        </p>
      </article>
    </section>
  );
}

function BackLink() {
  return (
    <Link
      href="/users"
      className="text-sm text-zinc-500 transition-colors hover:text-foreground"
    >
      ← 一覧へ戻る
    </Link>
  );
}
