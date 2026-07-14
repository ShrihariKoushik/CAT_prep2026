// Independent answer-key verification for Quant and LRDI.
// The generation call cannot audit itself — a self-check runs on the same
// forward pass that produced the error. So each question gets a FRESH context:
// solve cold, show work, state an answer. Key disagreement drops the question.
import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "./prompts";
import type { GeneratedQuestion } from "./schemas";

const LETTERS = ["A", "B", "C", "D"] as const;

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function verifyQuestion(q: GeneratedQuestion, context?: string): Promise<boolean> {
  const prompt = `Solve this multiple-choice question independently and carefully. Do not guess — work it out.
${context ? `\nContext / data:\n${context}\n` : ""}
Question:
${q.text}

${q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join("\n")}

Show your working briefly, then end with exactly one line in the form:
FINAL: X
where X is A, B, C, or D.`;

  try {
    const msg = await client().messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = /FINAL:\s*([ABCD])\b/i.exec(text);
    if (!m) return false;
    return LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number]) === q.correctIndex;
  } catch {
    return false; // verification error = not verified; the question is dropped, not the set
  }
}

/** Verify in parallel; returns a pass/fail flag per question, order preserved. */
export async function verifyAll(qs: GeneratedQuestion[], context?: string): Promise<boolean[]> {
  return Promise.all(qs.map((q) => verifyQuestion(q, context)));
}
