// Daily CAT — generation prompt design. Server-side only.
// One call per section per day. Strict JSON out, Zod-validated (schemas.ts),
// one retry with the validation error appended, then seed-bank fallback.
// Quant/LRDI answer keys additionally pass an independent verification call
// (verify.ts): generate surplus, ship only questions whose key survives a fresh solve.
import type { Section } from "@/lib/types";

export const MODEL = "claude-sonnet-4-6";

// ---------------------------------------------------------------------------
// Difficulty ladder — injected verbatim so the model anchors on a description,
// not a bare number.
// ---------------------------------------------------------------------------
export const DIFFICULTY_DESCRIPTORS: Record<number, string> = {
  1: "Very basic. A bright 10th grader should solve this. Single-concept, one-step problems, friendly numbers.",
  2: "Foundational/textbook. Direct formula application, at most two steps. NCERT class 10-12 level.",
  3: "Early CAT prep. Standard question templates from coaching material, requires choosing the right approach.",
  4: "Standard CAT prep. Two concepts combined, some algebraic manipulation, distractors based on common errors.",
  5: "Upper CAT prep. Multi-step reasoning, less obvious setup, at least one genuinely tempting wrong option.",
  6: "Actual CAT easy-slot difficulty. The kind of question a 90th-percentile aspirant solves in ~2 minutes.",
  7: "Actual CAT medium difficulty. Non-obvious modelling step; brute force is possible but slow.",
  8: "Actual CAT hard difficulty. Requires insight or an elegant shortcut; careless setups give a listed wrong answer.",
  9: "CAT 99th-percentile / toughest-slot questions. Multiple layered constraints; most aspirants skip these.",
  10: "IIFT-hard / CAT outlier difficulty. The hardest fair question you can write — no tricks, no ambiguity, just depth.",
};

// ---------------------------------------------------------------------------
// Topic pools — the generator samples from these (minus the 14-day recent
// window) and names the sampled topics in the prompt. Variety is enforced by
// us, not left to the model.
// ---------------------------------------------------------------------------
export const TOPIC_POOLS: Record<Section, string[]> = {
  QUANT: [
    "percentages", "profit-loss-discount", "simple-compound-interest",
    "ratio-proportion-variation", "mixtures-alligation", "averages",
    "time-speed-distance", "time-and-work", "pipes-cisterns",
    "linear-equations", "quadratic-equations", "inequalities", "functions",
    "logarithms", "progressions", "number-systems", "divisibility-remainders",
    "hcf-lcm", "surds-indices", "triangles", "circles", "polygons",
    "coordinate-geometry", "mensuration-2d", "mensuration-3d",
    "permutations-combinations", "probability", "set-theory-venn",
  ],
  VARC: [
    // passage topic areas (1/day):
    "economics", "philosophy", "science", "history", "sociology",
    // standalone kinds (3/day):
    "para-jumble", "para-summary", "odd-one-out",
  ],
  LRDI: [
    "linear-seating-arrangement", "circular-arrangement", "grid-puzzles",
    "selection-team-formation", "scheduling", "distribution",
    "ranking-ordering", "blood-relations-logic", "venn-based-lr",
    "games-tournaments", "table-based-di", "bar-chart-di", "line-chart-di",
    "pie-chart-di", "caselet-di", "mixed-graph-di", "routes-networks",
  ],
};

export const VARC_PASSAGE_AREAS = ["economics", "philosophy", "science", "history", "sociology"];
export const VARC_STANDALONE_KINDS = ["para-jumble", "para-summary", "odd-one-out"];

// ---------------------------------------------------------------------------
// Shared system prompt
// ---------------------------------------------------------------------------
export const SYSTEM_PROMPT = `You are a senior CAT (Common Admission Test, India) question setter and tutor. You write original, exam-faithful multiple-choice questions and explanations for one student's daily practice.

Non-negotiable rules:
- Every question must have exactly ONE defensibly correct answer among exactly 4 options. Solve the question yourself before writing the explanation. If you cannot verify it cleanly, replace the question.
- Wrong options must be plausible: base them on real mistakes (sign errors, off-by-one, misread constraints, superficially attractive interpretations) — never obviously absurd filler.
- Explanations are written in a direct, no-fluff tutoring voice. Second person, present tense. Show the fastest correct path first, then briefly say why EACH wrong option is wrong and what error would lead someone to pick it. No praise, no padding, no "Great question!".
- All numbers, names, and scenarios must be original — do not reproduce past CAT questions verbatim.
- Use Indian conventions (₹, lakh/crore where natural) but keep language plain.
- Output ONLY valid JSON matching the schema you are given. No markdown fences, no commentary before or after.`;

// ---------------------------------------------------------------------------
// Output JSON shapes (described in-prompt; enforced with Zod in schemas.ts)
// ---------------------------------------------------------------------------
const QUESTION_SHAPE = `{
  "topic": string,
  "kind": string,
  "text": string,
  "options": [string, string, string, string],
  "correctIndex": 0 | 1 | 2 | 3,
  "explanation": string
}`;

export const QUANT_JSON_SCHEMA = `{ "questions": [ /* exactly 10 items */ ${QUESTION_SHAPE} ] }
// kind is always "MCQ"`;

export const VARC_JSON_SCHEMA = `{
  "passage": {
    "topicArea": "economics" | "philosophy" | "science" | "history" | "sociology",
    "title": string,
    "body": string   // 300-350 words
  },
  "rcQuestions": [ /* exactly 5, kind "RC_PASSAGE_MCQ" */ ${QUESTION_SHAPE} ],
  "standaloneQuestions": [ /* exactly 3 */ ${QUESTION_SHAPE} ]
}`;

export const LRDI_JSON_SCHEMA = `{
  "miniSets": [ /* exactly 2 */
    {
      "type": string,                          // the assigned set type
      "scenario": { "title": string, "body": string },  // written ONCE — full data/clues here
      "questions": [ /* exactly 5 items */ ${QUESTION_SHAPE} ]  // kind "MCQ"
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------
export interface GenerationInput {
  section: Section;
  level: number;            // 1-10
  assignedTopics: string[]; // sampled from TOPIC_POOLS minus recent window
  recentTopics: string[];   // last 14 days for this section — avoid list
  day: string;
}

export function buildQuantPrompt(i: GenerationInput): string {
  return `Generate today's Quantitative Aptitude questions: exactly 10 questions. (Only the best 8 will be served; write all 10 to full quality.)

DIFFICULTY — Level ${i.level}/10: ${DIFFICULTY_DESCRIPTORS[i.level]}
All 10 questions at this level. Order them easiest → hardest within the level.

TOPICS — use each of these exactly once, in any order:
${i.assignedTopics.map((t, n) => `${n + 1}. ${t}`).join("\n")}

AVOID — recently seen; do not recycle their characteristic setups:
${i.recentTopics.join(", ") || "(none yet)"}

Target solve time: ~2 minutes per question at this level. Every question must be answerable without a calculator.

Return JSON only, matching:
${QUANT_JSON_SCHEMA}`;
}

export function buildVarcPrompt(i: GenerationInput): string {
  const [passageArea, ...standaloneKinds] = i.assignedTopics; // [area, kind, kind, kind]
  return `Generate today's VARC set: one reading-comprehension passage with 5 questions, plus 3 standalone questions. 8 questions total.

DIFFICULTY — Level ${i.level}/10: ${DIFFICULTY_DESCRIPTORS[i.level]}
At low levels, difficulty means transparent passages and clearly distinguishable options. At high levels, dense argumentative prose and options that differ on fine distinctions of scope, tone, or inference — never trick wording.

PASSAGE — topic area: ${passageArea}. 300-350 words. Non-fiction only: an argument, analysis, or explanation in the style of a serious magazine essay (Aeon, The Economist, LSE blog). It must take a position or develop a tension — not a neutral encyclopedia summary. Do not reuse themes from recent passages: ${i.recentTopics.join(", ") || "(none yet)"}.

RC QUESTIONS — exactly 5, kind "RC_PASSAGE_MCQ". The passage is displayed above each question in the app, so do NOT restate or quote large chunks of it in question text. Cover a mix of: main idea / primary purpose, specific inference, "the author would most likely agree/disagree", function of a phrase or example in context, strengthen/weaken or application. Wrong options must be wrong for classic RC reasons — out of scope, too extreme, distortion, true-but-not-asked — and the explanation must name which trap each wrong option is.

STANDALONE QUESTIONS — exactly 3, one each of kind: ${standaloneKinds.map((k) => k.toUpperCase().replace(/-/g, "_")).join(", ")}. These are self-contained; their full content goes in "text".
- PARA_JUMBLE: 4 sentences labelled A-D in the question text; options are orderings like "BDAC". Exactly one coherent order.
- PARA_SUMMARY: a 60-90 word paragraph in the question text; options are one-sentence summaries. Wrong ones are too narrow, too broad, or subtly distorted.
- ODD_ONE_OUT: 4 sentences where 3 form a coherent paragraph; options are "Sentence A"…"Sentence D".

Return JSON only, matching:
${VARC_JSON_SCHEMA}`;
}

export function buildLrdiPrompt(i: GenerationInput): string {
  const [typeA, typeB] = i.assignedTopics; // 2 set types per day
  return `Generate today's LRDI questions as TWO self-contained mini-sets of 5 questions each. (Only the best 4 per mini-set will be served; write all 5 to full quality.)

DIFFICULTY — Level ${i.level}/10: ${DIFFICULTY_DESCRIPTORS[i.level]}

MINI-SET 1 — type: ${typeA}. MINI-SET 2 — type: ${typeB}.

SCENARIO — write each mini-set's scenario EXACTLY ONCE in its "scenario" field: all data (tables as plain aligned text), conditions, and clues, under 120 words. The app displays the scenario above every question in that mini-set, so question "text" must contain ONLY the question — never restate the data. All questions must be answerable from the scenario field alone.

The 5 questions per mini-set escalate: Q1 direct read-off/deduction, Q2-Q4 combinations of constraints, Q5 the full deduction. Constraints must pin down a unique valid configuration (or state clearly when multiple are possible and ask what MUST be true).

AVOID these recently used set types: ${i.recentTopics.join(", ") || "(none yet)"}.

Solve your own puzzle completely before writing answers. If the constraint set is contradictory or under-determined where it shouldn't be, rewrite it.

Target: ~2 minutes per question after the initial setup parse.

Return JSON only, matching:
${LRDI_JSON_SCHEMA}`;
}

// ---------------------------------------------------------------------------
// Pipeline (implemented in generate.ts):
// 1. Acquire the (day, section) GenerationJob lock — create, or claim FAILED /
//    stale-RUNNING (>5 min). Losing racer exits; no duplicate API spend.
// 2. Read level (UserState) + last-14-days topics (QuestionSet.promptTopics).
//    Sample assigned topics: QUANT 10, VARC 1 area + 3 kinds, LRDI 2 set types.
// 3. Call claude-sonnet-4-6, parse, Zod-validate. One retry with the Zod error
//    appended ("Your previous output failed validation: … Fix and resend.").
// 4. VERIFY (Quant + LRDI only — generation and self-check share a forward
//    pass, so the check must be a fresh context): for each question, an
//    independent call solves it cold and states an answer. Disagreement drops
//    the question. Quant ships 8 of 10 survivors; LRDI ships 4 of 5 per
//    mini-set. Too few survivors = section failure.
// 5. Persist atomically (set + contexts + questions). On any failure: job
//    FAILED, seed-bank fallback set served, and every page load retries
//    generation (through the same lock) until READY — replacing the fallback
//    only if she hasn't started it.
// ---------------------------------------------------------------------------
