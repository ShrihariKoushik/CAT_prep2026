"use client";
import { useState } from "react";
import { postJson } from "@/lib/clientFetch";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await postJson("/api/auth/register", { username, password, name });
      } else {
        await postJson("/api/auth/login", { username, password });
      }
      window.location.assign("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const input =
    "rounded-2xl border border-cream-300 dark:border-night-600 bg-transparent px-4 py-3 text-base outline-none focus:border-terra-500";

  return (
    <main className="pt-16 flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Daily CAT</h1>
        <p className="text-sm text-ink-600 dark:text-cream-300 mt-1">
          {mode === "login" ? "welcome back" : "create your account"}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {mode === "signup" && (
          <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input
          className={input}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="text-sm text-terra-600 dark:text-terra-200">{error}</p>}
        <button
          onClick={submit}
          disabled={busy || !username.trim() || !password || (mode === "signup" && !name.trim())}
          className="rounded-full bg-terra-500 text-white font-medium py-3 disabled:opacity-40"
        >
          {busy ? "…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </div>

      <button
        onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
        className="text-sm text-terra-600 dark:text-terra-200"
      >
        {mode === "login" ? "New here? Create an account" : "Have an account? Log in"}
      </button>
    </main>
  );
}
