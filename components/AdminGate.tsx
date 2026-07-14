"use client";
import { useState } from "react";
import { postJson } from "@/lib/clientFetch";

export default function AdminGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin/login", { password });
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="pt-16 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="text-sm text-ink-600 dark:text-cream-300">Enter the admin password.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Admin password"
        autoFocus
        className="rounded-2xl border border-cream-300 dark:border-night-600 bg-transparent px-4 py-3 text-base outline-none focus:border-terra-500"
      />
      {error && <p className="text-sm text-terra-600 dark:text-terra-200">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !password}
        className="rounded-full bg-terra-500 text-white font-medium py-3 disabled:opacity-40"
      >
        {busy ? "…" : "Enter"}
      </button>
    </main>
  );
}
