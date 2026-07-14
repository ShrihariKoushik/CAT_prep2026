import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SECTION_LABEL, TIMER_SECONDS, type Section } from "@/lib/types";
import QuizRunner, { type ClientQuestion, type InitialAnswer } from "@/components/QuizRunner";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const set = await prisma.questionSet.findUnique({
    where: { id: setId },
    include: {
      questions: { orderBy: { orderInSet: "asc" }, include: { context: true } },
      attempt: { include: { answers: true } },
    },
  });
  if (!set) notFound();

  const section = set.section as Section;

  // Already submitted → read-only summary
  if (set.attempt?.completedAt) {
    const a = set.attempt;
    return (
      <main className="pt-8 flex flex-col gap-4">
        <h1 className="text-xl font-semibold">{SECTION_LABEL[section]} — {set.day}</h1>
        <div className="rounded-2xl bg-cream-100 dark:bg-night-800 p-5 text-center">
          <div className="text-4xl font-semibold">{a.score}/8</div>
          <div className="text-sm text-ink-600 dark:text-cream-300 mt-1">completed</div>
        </div>
        <div className="flex flex-col gap-3">
          {set.questions.map((q, i) => {
            const ans = a.answers.find((x) => x.questionId === q.id);
            const options = JSON.parse(q.options) as string[];
            const L = ["A", "B", "C", "D"];
            return (
              <details key={q.id} className="rounded-xl border border-cream-200 dark:border-night-700 p-3">
                <summary className="flex items-center gap-2 cursor-pointer list-none">
                  <span className={ans?.isCorrect ? "text-sage-600 dark:text-sage-200" : "text-terra-600 dark:text-terra-200"}>
                    {ans?.isCorrect ? "✓" : ans?.chosenIndex == null ? "–" : "✗"}
                  </span>
                  <span className="text-sm line-clamp-1 flex-1">Q{i + 1}. {q.text}</span>
                </summary>
                <div className="mt-3 text-sm flex flex-col gap-2">
                  {q.context && <p className="text-ink-600 dark:text-cream-300 whitespace-pre-wrap text-xs">{q.context.body}</p>}
                  <p className="whitespace-pre-wrap">{q.text}</p>
                  <div>
                    {ans?.chosenIndex != null ? `You chose ${L[ans.chosenIndex]}. ` : "You skipped this. "}
                    Correct: {L[q.correctIndex]}. {options[q.correctIndex]}
                  </div>
                  <p className="text-ink-600 dark:text-cream-300 whitespace-pre-wrap">{q.explanation}</p>
                </div>
              </details>
            );
          })}
        </div>
        <Link href="/" className="rounded-full bg-terra-500 text-white text-center font-medium py-3">Back home</Link>
      </main>
    );
  }

  const questions: ClientQuestion[] = set.questions.map((q) => ({
    id: q.id,
    kind: q.kind,
    topic: q.topic,
    text: q.text,
    options: JSON.parse(q.options) as string[],
    contextTitle: q.context?.title,
    contextBody: q.context?.body,
    // correctIndex & explanation deliberately NOT sent — revealed via API only
  }));

  // Saved answers (attempt started but not submitted) → resume where she left off.
  // Answer keys are only included for questions she has ALREADY answered.
  const initialAnswers: Record<string, InitialAnswer> = {};
  for (const a of set.attempt?.answers ?? []) {
    const q = set.questions.find((x) => x.id === a.questionId);
    if (!q) continue;
    const answered = a.chosenIndex !== null;
    initialAnswers[a.questionId] = {
      chosenIndex: a.chosenIndex,
      isCorrect: a.isCorrect,
      correctIndex: answered ? q.correctIndex : -1,
      explanation: answered ? q.explanation : "",
      flagged: a.flagged,
      timeSpentSec: a.timeSpentSec,
    };
  }

  return (
    <main>
      <QuizRunner
        setId={set.id}
        sectionLabel={SECTION_LABEL[section]}
        timerSeconds={TIMER_SECONDS[section]}
        questions={questions}
        initialAnswers={initialAnswers}
      />
    </main>
  );
}
