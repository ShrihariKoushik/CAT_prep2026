import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { SECTION_SHORT, SECTIONS, type Section } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const L = ["A", "B", "C", "D"];

type SP = { section?: string; level?: string; date?: string; wrong?: string; page?: string };

export default async function ArchivePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Only MY questions: every question belongs to a per-user set.
  const where: Prisma.QuestionWhereInput = { set: { userId: user.id } };
  if (sp.section && SECTIONS.includes(sp.section as Section)) where.section = sp.section;
  if (sp.level) where.difficulty = parseInt(sp.level, 10) || undefined;
  if (sp.date) where.set = { userId: user.id, day: sp.date };
  if (sp.wrong === "1") where.attempts = { some: { isCorrect: false, userId: user.id } };

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        set: true,
        context: true,
        attempts: { where: { isRedo: false, userId: user.id }, orderBy: { answeredAt: "desc" }, take: 1 },
      },
      orderBy: [{ set: { day: "desc" } }, { orderInSet: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.question.count({ where }),
  ]);

  const qs = (over: Partial<SP>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    return `/archive?${params.toString()}`;
  };

  return (
    <main className="pt-8 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Archive</h1>
        <Link href="/" className="text-sm text-terra-600 dark:text-terra-200">home</Link>
      </div>

      {/* filters */}
      <form className="flex flex-wrap gap-2 text-sm" method="GET">
        <select name="section" defaultValue={sp.section ?? ""} className="rounded-full border border-cream-300 dark:border-night-600 bg-transparent px-3 py-2">
          <option value="">All sections</option>
          {SECTIONS.map((s) => <option key={s} value={s}>{SECTION_SHORT[s]}</option>)}
        </select>
        <select name="level" defaultValue={sp.level ?? ""} className="rounded-full border border-cream-300 dark:border-night-600 bg-transparent px-3 py-2">
          <option value="">Any level</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((l) => <option key={l} value={l}>L{l}</option>)}
        </select>
        <input type="date" name="date" defaultValue={sp.date ?? ""} className="rounded-full border border-cream-300 dark:border-night-600 bg-transparent px-3 py-2" />
        <label className="flex items-center gap-1.5 rounded-full border border-cream-300 dark:border-night-600 px-3 py-2">
          <input type="checkbox" name="wrong" value="1" defaultChecked={sp.wrong === "1"} />
          got wrong
        </label>
        <button className="rounded-full bg-terra-500 text-white px-4 py-2">Filter</button>
      </form>

      <p className="text-xs text-ink-400 dark:text-cream-300/60">{total} questions</p>

      <div className="flex flex-col gap-3">
        {questions.map((q) => {
          const a = q.attempts[0];
          const options = JSON.parse(q.options) as string[];
          return (
            <details key={q.id} className="rounded-xl border border-cream-200 dark:border-night-700 p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-2 text-xs text-ink-600 dark:text-cream-300 mb-1">
                  <span>{q.set?.day ?? "—"}</span>
                  <span className="rounded-full bg-cream-100 dark:bg-night-800 px-2 py-0.5">{SECTION_SHORT[q.section as Section]}</span>
                  <span>L{q.difficulty}</span>
                  {a && (
                    <span className={a.isCorrect ? "text-sage-600 dark:text-sage-200" : "text-terra-600 dark:text-terra-200"}>
                      {a.isCorrect ? "✓" : a.chosenIndex == null ? "skipped" : "✗"}
                    </span>
                  )}
                </div>
                <div className="text-sm line-clamp-2">{q.text}</div>
              </summary>
              <div className="mt-3 text-sm flex flex-col gap-2">
                {q.context && (
                  <p className="text-xs text-ink-600 dark:text-cream-300 whitespace-pre-wrap rounded-lg bg-cream-100 dark:bg-night-800 p-2">
                    {q.context.body}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{q.text}</p>
                <ul className="flex flex-col gap-1">
                  {options.map((o, i) => (
                    <li
                      key={i}
                      className={
                        i === q.correctIndex
                          ? "text-sage-600 dark:text-sage-200"
                          : a?.chosenIndex === i
                            ? "text-terra-600 dark:text-terra-200 line-through"
                            : ""
                      }
                    >
                      {L[i]}. {o}
                      {i === q.correctIndex ? " ← correct" : a?.chosenIndex === i ? " ← her answer" : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-ink-600 dark:text-cream-300 whitespace-pre-wrap">{q.explanation}</p>
              </div>
            </details>
          );
        })}
      </div>

      <div className="flex justify-between text-sm">
        {page > 1 ? <Link className="text-terra-600 dark:text-terra-200" href={qs({ page: String(page - 1) })}>← newer</Link> : <span />}
        {page * PAGE_SIZE < total ? <Link className="text-terra-600 dark:text-terra-200" href={qs({ page: String(page + 1) })}>older →</Link> : <span />}
      </div>
    </main>
  );
}
