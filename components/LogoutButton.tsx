"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return (
    <button onClick={logout} className="text-xs text-ink-400 dark:text-cream-300/60">
      log out
    </button>
  );
}
