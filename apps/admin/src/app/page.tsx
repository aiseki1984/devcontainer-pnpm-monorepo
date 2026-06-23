import { redirect } from "next/navigation";

// 入口は保護領域へ。未ログインなら proxy が /login にリダイレクトする。
export default function Home() {
  redirect("/dashboard");
}
