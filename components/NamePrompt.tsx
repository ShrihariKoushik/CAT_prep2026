"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NamePrompt() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body.slice(0, 200)}`);
      }
      router.refresh();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-cream-100 dark:bg-night-800 p-5 flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Before we start —</h2>
        <p className="text-sm text-ink-600 dark:text-cream-300">what should I call you?</p>
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Your name"
          autoFocus
          className="flex-1 rounded-full border border-cream-300 dark:border-night-600 bg-transparent px-4 py-3 text-base outline-none focus:border-terra-500"
        />
        <button
          onClick={save}
          disabled={!name.trim() || busy}
          className="rounded-full bg-terra-500 text-white font-medium px-5 disabled:opacity-40"
        >
          {busy ? "…" : "Save"}
        </button>
      </div>
      {error && (
        <p className="text-sm text-terra-600 dark:text-terra-200 break-all">
          Couldn't save — {error}
          {error.includes("500") ? " (did you run `npm run db:push` and restart the dev server?)" : ""}
        </p>
      )}
    </section>
  );
}
