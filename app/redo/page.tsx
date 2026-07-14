import { dueReviewItems } from "@/lib/sr";
import { istToday } from "@/lib/time";
import RedoRunner from "@/components/RedoRunner";
import type { ClientQuestion } from "@/components/QuizRunner";

export const dynamic = "force-dynamic";

export default async function RedoPage() {
  const items = await dueReviewItems(istToday());
  const questions: ClientQuestion[] = items.map((it) => ({
    id: it.question.id,
    kind: it.question.kind,
    topic: it.question.topic,
    text: it.question.text,
    options: JSON.parse(it.question.options) as string[],
    contextTitle: it.question.context?.title,
    contextBody: it.question.context?.body,
  }));
  return (
    <main>
      <RedoRunner items={questions} />
    </main>
  );
}
