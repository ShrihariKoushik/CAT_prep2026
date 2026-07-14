// Admin portal: every user's levels, streaks, totals, and recent sessions.
// Admin = the first registered user. Read-only view of others' data.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { istToday } from "@/lib/time";
import { displayStreak } from "@/lib/streak";
import { SECTION_SHORT, type Section } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/");

  const today = istToday();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      attempts: {
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 10,
        include: { set: true },
      },
      _count: { select: { reviewItems: { where: { retiredAt: null } } } },
    },
  });

  return (
    <main className="pt-8 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-full border border-cream-300 dark:border-night-600 px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold">Admin</h1>
        <span className="text-xs text-ink-400 dark:text-cream-300/60">{users.length} user{users.length === 1 ? "" : "s"}</span>
      </div>

      {users.map((u) => {
        const acc = u.totalAnswered ? Math.round((100 * u.totalCorrect) / u.totalAnswered) : 0;
        return (
          <details key={u.id} className="rounded-2xl border border-cream-200 dark:border-night-700 p-4" open={users.length <= 2}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{u.name}</span>{" "}
                  <span className="text-xs text-ink-600 dark:text-cream-300">@{u.username}</span>
                  {u.isAdmin && <span className="text-xs text-terra-600 dark:text-terra-200"> · admin</span>}
                </div>
                <span className="text-sm text-ink-600 dark:text-cream-300">
                  {displayStreak(u, today)}🔥
                </span>
              </div>
              <div className="mt-1 text-xs text-ink-600 dark:text-cream-300">
                Q L{u.levelQuant} · V L{u.levelVarc} · L L{u.levelLrdi} · {u.totalAnswered} answered · {acc}% · {u._count.reviewItems} in redo queue · longest streak {u.longestStreak}
              </div>
            </summary>

            <div className="mt-3 flex flex-col gap-1.5">
              <div className="text-xs font-medium text-ink-600 dark:text-cream-300">Recent sessions</div>
              {u.attempts.length === 0 && (
                <p className="text-sm text-ink-400 dark:text-cream-300/60">no completed sessions yet</p>
              )}
              {u.attempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm rounded-lg bg-cream-100 dark:bg-night-800 px-3 py-2">
                  <span>
                    {a.set.day} · {SECTION_SHORT[a.set.section as Section]} · L{a.levelBefore}
                    {a.levelAfter != null && a.levelAfter !== a.levelBefore
                      ? a.levelAfter > a.levelBefore ? " ↑" : " ↓"
                      : ""}
                  </span>
                  <span className={a.score != null && a.score >= 6 ? "text-sage-600 dark:text-sage-200" : ""}>
                    {a.score}/8
                    {a.totalTimeSec ? ` · ${Math.round(a.totalTimeSec / 60)}m` : ""}
                  </span>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </main>
  );
}

