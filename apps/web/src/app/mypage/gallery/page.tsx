import Link from "next/link";
import { redirect } from "next/navigation";
import { userApiGet } from "../../../lib/server-api";
import { Gallery, type GalleryImage } from "../../../components/gallery";

type GalleryList = { images: GalleryImage[] };

export default async function GalleryPage() {
  // 認証は proxy（期限切れ→refresh）と userApiGet（401→/login）が担う。
  const res = await userApiGet("/me/gallery");
  if (!res.ok) redirect("/login");
  const { images } = (await res.json()) as GalleryList;

  return (
    <main className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <section className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">
          マイギャラリー
        </h1>
        <p className="text-sm text-zinc-500">
          自分だけが見られる非公開の画像です。
        </p>
        <Gallery initialImages={images} />
        <Link href="/mypage" className="text-sm text-zinc-500 hover:underline">
          ← マイページ
        </Link>
      </section>
    </main>
  );
}
