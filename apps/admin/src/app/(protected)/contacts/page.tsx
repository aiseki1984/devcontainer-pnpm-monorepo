"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/api";

/** API（GET /admin/contacts）が返すお問い合わせ1件分の形。db の Contact に対応。 */
type Contact = {
  id: number;
  name: string;
  email: string;
  title: string;
  message: string;
  createdAt: string;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    adminFetch("/admin/contacts")
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return (await res.json()).data as Contact[];
      })
      .then((rows) => {
        if (active) setContacts(rows);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">お問い合わせ</h1>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          お問い合わせの取得に失敗しました。
        </p>
      ) : contacts === null ? (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-zinc-500">お問い合わせはまだありません。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex flex-col gap-2 rounded-2xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
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
              <p className="whitespace-pre-wrap text-sm">{contact.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
