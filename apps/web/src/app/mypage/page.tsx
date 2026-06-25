import { redirect } from "next/navigation";
import { userApiGet } from "../../lib/server-api";
import { AvatarUploader } from "../../components/avatar-uploader";

type Me = {
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    avatarKey: string | null;
  };
};
type AvatarUrl = { url: string | null };

export default async function MyPage() {
  // 認証は proxy（期限切れ→refresh）と userApiGet（401→/login）が担う。
  // /me と /me/avatar は互いに独立なので直列待ちせず並行で取得する。
  const [res, avatarRes] = await Promise.all([
    userApiGet("/me"),
    userApiGet("/me/avatar"),
  ]);
  if (!res.ok) redirect("/login");

  const { user } = (await res.json()) as Me;

  // 表示用のアバター URL（presigned GET）。未設定・失敗時は null。
  const { url: avatarUrl } = avatarRes.ok
    ? ((await avatarRes.json()) as AvatarUrl)
    : { url: null };

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <section className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">マイページ</h1>

        <AvatarUploader initialUrl={avatarUrl} />

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
            <dt className="text-zinc-500">name</dt>
            <dd>{user.name}</dd>
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
