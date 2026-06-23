"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "../../lib/api";
import { toErrorMessage, type ErrorBody } from "../../lib/error-message";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    title: "",
    message: "",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update(key: keyof typeof form) {
    return (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setError(
          toErrorMessage(
            (await res.json().catch(() => null)) as ErrorBody | null,
            "送信に失敗しました",
          ),
        );
        return;
      }
      setDone(true);
    } catch {
      setError("通信に失敗しました");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-black">
        <h1 className="text-2xl font-semibold tracking-tight">送信しました</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          お問い合わせありがとうございます。
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <h1 className="text-2xl font-semibold tracking-tight">お問い合わせ</h1>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          お名前
          <input
            type="text"
            required
            value={form.name}
            onChange={update("name")}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input
            type="email"
            required
            value={form.email}
            onChange={update("email")}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          件名
          <input
            type="text"
            required
            value={form.title}
            onChange={update("title")}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          本文
          <textarea
            required
            rows={5}
            value={form.message}
            onChange={update("message")}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-11 rounded-full bg-foreground font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {pending ? "送信中…" : "送信"}
        </button>
      </form>
    </main>
  );
}
