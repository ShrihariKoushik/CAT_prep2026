// Generation pipeline, per user. Server-side only — the API key never reaches the client.
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import { prisma } from "@/lib/prisma";
import { createFallbackSet } from "@/lib/seedBank";
import { istDayOffset } from "@/lib/time";
import { SECTIONS, SLOT_FOR_SECTION, type Section } from "@/lib/types";
import { currentLevel } from "@/lib/levels";
import {
  MODEL, SYSTEM_PROMPT, TOPIC_POOLS, VARC_PASSAGE_AREAS, VARC_STANDALONE_KINDS,
  buildQuantPrompt, buildVarcPrompt, buildLrdiPrompt, type GenerationInput,
} from "./prompts";
import { QuantOutZ, VarcOutZ, LrdiOutZ, type GeneratedQuestion } from "./schemas";
import { verifyAll } from "./verify";

const LOCK_STALE_MS = 5 * 60_000;

type PersistContext = { kind: string; title: string; body: string; order: number };
type PersistQuestion = GeneratedQuestion & { contextOrder?: number; verified: boolean };

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Daily cron: generate all three sections for every user. */
export async function cronGenerate(day: string) {
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const results: Record<string, string> = {};
  for (const u of users) {
    for (const section of SECTIONS) {
      results[`${u.username}:${section}`] = await generateWithLock(day, section, u.id);
    }
  }
  return results;
}

/**
 * Lock-guarded generation for one user+section. Returns "skipped" if another
 * worker holds the lock or the set is already READY — safe on every page load.
 */
export async function generateWithLock(day: string, section: Section, userId: string): Promise<string> {
  const existing = await prisma.questionSet.findUnique({
    where: { day_section_userId: { day, section, userId } },
    include: { attempt: true },
  });
  if (existing?.status === "READY") return "already-ready";
  if (existing?.attempt) return "fallback-in-use";

  const lock = await acquireLock(day, section, userId);
  if (!lock) return "skipped";

  try {
    await generateSection(day, section, userId);
    await prisma.generationJob.update({
      where: { id: lock.id },
      data: { status: "SUCCESS", finishedAt: new Date(), error: null },
    });
    return "generated";
  } catch (e) {
    await prisma.generationJob.update({
      where: { id: lock.id },
      data: { status: "FAILED", finishedAt: new Date(), error: String(e).slice(0, 1000) },
    });
    await createFallbackSet(day, section, userId);
    return "failed-fallback";
  }
}

// ---------------------------------------------------------------------------
// Lock: GenerationJob unique(day, section, userId). Create wins; otherwise
// claim FAILED / stale-RUNNING via conditional updateMany (atomic).
// ---------------------------------------------------------------------------
async function acquireLock(day: string, section: Section, userId: string) {
  try {
    return await prisma.generationJob.create({ data: { day, section, userId } });
  } catch {
    const stale = new Date(Date.now() - LOCK_STALE_MS);
    const { count } = await prisma.generationJob.updateMany({
      where: {
        day, section, userId,
        OR: [{ status: "FAILED" }, { status: "RUNNING", startedAt: { lt: stale } }],
      },
      data: { status: "RUNNING", startedAt: new Date(), finishedAt: null },
    });
    if (count === 0) return null;
    return prisma.generationJob.findUnique({
      where: { day_section_userId: { day, section, userId } },
    });
  }
}

// ---------------------------------------------------------------------------
// Core generation
// ---------------------------------------------------------------------------
async function generateSection(day: string, section: Section, userId: string) {
  const level = await currentLevel(section, userId);
  const recentTopics = await recentTopicsFor(section, day, userId);
  const assignedTopics = sampleTopics(section, recentTopics);
  const input: GenerationInput = { section, level, assignedTopics, recentTopics, day };

  let contexts: PersistContext[] = [];
  let questions: PersistQuestion[] = [];

  if (section === "QUANT") {
    const out = await generateValidated(buildQuantPrompt(input), QuantOutZ);
    const passed = await verifyAll(out.questions);
    const survivors = out.questions.filter((_, i) => passed[i]);
    if (survivors.length < 8) {
      throw new Error(`QUANT verification: only ${survivors.length}/10 keys survived independent solve`);
    }
    questions = survivors.slice(0, 8).map((q) => ({ ...q, kind: "MCQ", verified: true }));
  } else if (section === "VARC") {
    const out = await generateValidated(buildVarcPrompt(input), VarcOutZ);
    contexts = [{ kind: "RC_PASSAGE", title: out.passage.title, body: out.passage.body, order: 0 }];
    questions = [
      ...out.rcQuestions.map((q) => ({ ...q, kind: "RC_PASSAGE_MCQ", contextOrder: 0, verified: false })),
      ...out.standaloneQuestions.map((q) => ({ ...q, verified: false })),
    ];
  } else {
    const out = await generateValidated(buildLrdiPrompt(input), LrdiOutZ);
    for (let s = 0; s < 2; s++) {
      const mini = out.miniSets[s];
      contexts.push({ kind: "LRDI_SCENARIO", title: mini.scenario.title, body: mini.scenario.body, order: s });
      const passed = await verifyAll(mini.questions, mini.scenario.body);
      const survivors = mini.questions.filter((_, i) => passed[i]);
      if (survivors.length < 4) {
        throw new Error(`LRDI mini-set ${s + 1} (${mini.type}): only ${survivors.length}/5 keys survived`);
      }
      questions.push(...survivors.slice(0, 4).map((q) => ({ ...q, kind: "MCQ", contextOrder: s, verified: true })));
    }
  }

  await persistSet(day, section, userId, level, assignedTopics, contexts, questions);
}

async function persistSet(
  day: string, section: Section, userId: string, level: number, topics: string[],
  contexts: PersistContext[], questions: PersistQuestion[],
) {
  await prisma.$transaction(async (tx) => {
    const old = await tx.questionSet.findUnique({
      where: { day_section_userId: { day, section, userId } },
      include: { attempt: true },
    });
    if (old) {
      if (old.attempt) throw new Error("set already attempted; refusing to replace");
      await tx.questionSet.delete({ where: { id: old.id } });
    }
    const set = await tx.questionSet.create({
      data: {
        day, section, userId,
        slot: SLOT_FOR_SECTION[section],
        difficulty: level,
        status: "READY",
        model: MODEL,
        promptTopics: JSON.stringify(topics),
      },
    });
    const contextIds: string[] = [];
    for (const c of contexts) {
      const ctx = await tx.contextBlock.create({ data: { setId: set.id, ...c } });
      contextIds.push(ctx.id);
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await tx.question.create({
        data: {
          setId: set.id,
          contextId: q.contextOrder != null ? contextIds[q.contextOrder] : null,
          section,
          difficulty: level,
          kind: q.kind,
          topic: q.topic,
          orderInSet: i,
          text: q.text,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          verified: q.verified,
        },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Model call + validation retry
// ---------------------------------------------------------------------------
async function callClaude(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}

async function generateValidated<T>(prompt: string, schema: ZodType<T>): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = attempt === 0
      ? prompt
      : `${prompt}\n\nYour previous output failed validation:\n${lastError}\nFix the problems and resend the complete JSON.`;
    try {
      return schema.parse(extractJson(await callClaude(p)));
    } catch (e) {
      lastError = String(e).slice(0, 800);
    }
  }
  throw new Error(`output failed validation twice: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Topic sampling — per-user 14-day no-repeat window
// ---------------------------------------------------------------------------
async function recentTopicsFor(section: Section, day: string, userId: string): Promise<string[]> {
  const since = istDayOffset(day, -14);
  const sets = await prisma.questionSet.findMany({
    where: { section, userId, day: { gte: since, lt: day }, isFallback: false },
    select: { promptTopics: true },
  });
  const topics = new Set<string>();
  for (const s of sets) {
    try { for (const t of JSON.parse(s.promptTopics)) topics.add(t); } catch { /* ignore */ }
  }
  return [...topics];
}

function sampleTopics(section: Section, recent: string[]): string[] {
  const pick = (pool: string[], n: number): string[] => {
    let avail = pool.filter((t) => !recent.includes(t));
    if (avail.length < n) avail = [...pool];
    const out: string[] = [];
    while (out.length < n && avail.length) {
      const i = Math.floor(Math.random() * avail.length);
      out.push(avail.splice(i, 1)[0]);
    }
    while (out.length < n) out.push(pool[Math.floor(Math.random() * pool.length)]);
    return out;
  };

  if (section === "QUANT") return pick(TOPIC_POOLS.QUANT, 10);
  if (section === "LRDI") return pick(TOPIC_POOLS.LRDI, 2);
  return [...pick(VARC_PASSAGE_AREAS, 1), ...VARC_STANDALONE_KINDS];
}
