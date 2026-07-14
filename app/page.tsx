import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isAdminSession } from "@/lib/auth";
import { getHomeData } from "@/lib/home";
import { istHourNow } from "@/lib/time";
import { quoteForDay } from "@/lib/quotes";
import { SECTION_SHORT, SECTIONS } from "@/lib/types";
import SessionCard from "@/components/SessionCard";
import Heatmap from "@/components/Heatmap";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

function greeting() {
  const h = istHourNow();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const data = await getHomeData(user);
  const admin = await isAdminSession(); // link shows only after admin-password entry; /admin itself is always gated

  return (
    <main className="pt-8 flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-600 dark:text-cream-300">
            {greeting()}, {data.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Daily CAT</h1>
          <p className="mt-1 text-sm italic text-terra-600 dark:text-terra-200">
            {quoteForDay(data.today)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 pt-1">
          {admin && (
            <Link href="/admin" className="text-xs text-terra-600 dark:text-terra-200">
              admin
            </Link>
          )}
          <LogoutButton />
        </div>
      </header>

      {/* streak + levels */}
      <section className="rounded-2xl bg-cream-100 dark:bg-night-800 p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-semibold">{data.streak.current}</span>
            <span className="text-sm text-ink-600 dark:text-cream-300"> day streak</span>
          </div>
          <div className="text-right text-xs text-ink-600 dark:text-cream-300 leading-5">
            <div>longest {data.streak.longest}</div>
            <div>{data.streak.freezeAvailable ? "❄ freeze ready" : "freeze used this week"}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {SECTIONS.map((s) => (
            <div key={s} className="flex-1 rounded-xl bg-cream-50 dark:bg-night-700 px-3 py-2 text-center">
              <div className="text-xs text-ink-600 dark:text-cream-300">{SECTION_SHORT[s]}</div>
              <div className="text-lg font-semibold">L{data.levels[s]}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-ink-400 dark:text-cream-300/60">
          {data.totals.answered} questions answered · {data.totals.answered ? Math.round((100 * data.totals.correct) / data.totals.answered) : 0}% correct all-time
        </div>
      </section>

      {/* today's sessions */}
      <section className="flex flex-col gap-3">
        {data.sessions.map((s) => (
          <SessionCard key={s.section} {...s} />
        ))}
      </section>

      {/* redo + archive */}
      <section className="flex gap-3">
        <Link
          href="/redo"
          className="flex-1 rounded-2xl border border-cream-200 dark:border-night-700 p-4 active:scale-[0.99] transition"
        >
          <div className="font-medium">Redo mistakes</div>
          <div className="text-sm text-ink-600 dark:text-cream-300">
            {data.redoDue > 0 ? `${data.redoDue} due for review` : "nothing due — nice"}
          </div>
        </Link>
        <Link
          href="/archive"
          className="flex-1 rounded-2xl border border-cream-200 dark:border-night-700 p-4 active:scale-[0.99] transition"
        >
          <div className="font-medium">Archive</div>
          <div className="text-sm text-ink-600 dark:text-cream-300">every question, forever</div>
        </Link>
      </section>

      {/* heatmap */}
      <section>
        <h2 className="text-sm font-medium text-ink-600 dark:text-cream-300 mb-2">Last 90 days</h2>
        <Heatmap cells={data.heatmap} />
      </section>
    </main>
  );
}
