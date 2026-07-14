// Streak + freeze + day rollup. Only FRESH set completions call into this —
// Redo Mistakes never touches the streak (farmable otherwise).
// FREEZE: one per calendar week, boundary = Monday 00:00 IST. Covers exactly
// one missed day between lastActiveDay and today.
import { prisma } from "./prisma";
import { istDayOffset, mondayOf } from "./time";
import { getUserState } from "./levels";

type Db = typeof prisma;

/** Replenish the weekly freeze if we've crossed a Monday-00:00-IST boundary. Call on read paths too. */
export async function replenishFreeze(today: string, db: Db = prisma) {
  const state = await getUserState(db);
  const monday = mondayOf(today);
  if (state.freezeResetWeek !== monday) {
    return db.userState.update({
      where: { id: 1 },
      data: { freezeAvailable: true, freezeResetWeek: monday },
    });
  }
  return state;
}

/** Register a completed fresh session. Updates DayLog, totals, and the streak. */
export async function registerSessionCompletion(
  today: string,
  answered: number,
  correct: number,
  db: Db = prisma,
) {
  const state = await replenishFreeze(today, db);

  const log = await db.dayLog.upsert({
    where: { day: today },
    create: { day: today, sessionsCompleted: 1, questionsAnswered: answered },
    update: {
      sessionsCompleted: { increment: 1 },
      questionsAnswered: { increment: answered },
    },
  });

  const data: Record<string, unknown> = {
    totalAnswered: { increment: answered },
    totalCorrect: { increment: correct },
  };

  // First completion today → streak day earned
  if (log.sessionsCompleted === 1) {
    const yesterday = istDayOffset(today, -1);
    const twoAgo = istDayOffset(today, -2);
    let streak: number;

    if (state.lastActiveDay === today) {
      streak = state.currentStreak; // defensive; shouldn't happen when log was 0
    } else if (state.lastActiveDay === yesterday) {
      streak = state.currentStreak + 1;
    } else if (state.lastActiveDay === twoAgo && state.freezeAvailable) {
      // exactly one missed day + freeze available → streak survives
      streak = state.currentStreak + 1;
      data.freezeAvailable = false;
      await db.dayLog.upsert({
        where: { day: yesterday },
        create: { day: yesterday, freezeUsed: true },
        update: { freezeUsed: true },
      });
    } else {
      streak = 1; // gap too big or no freeze — start over
    }

    data.currentStreak = streak;
    data.longestStreak = Math.max(state.longestStreak, streak);
    data.lastActiveDay = today;
  }

  return db.userState.update({ where: { id: 1 }, data: data as never });
}

/**
 * Streak as it should DISPLAY right now (state only updates on completions):
 * still alive if last activity was today/yesterday, or two days ago with a
 * freeze in hand (completing today would save it). Otherwise 0.
 */
export function displayStreak(
  state: { currentStreak: number; lastActiveDay: string | null; freezeAvailable: boolean },
  today: string,
): number {
  if (!state.lastActiveDay) return 0;
  const yesterday = istDayOffset(today, -1);
  const twoAgo = istDayOffset(today, -2);
  if (state.lastActiveDay === today || state.lastActiveDay === yesterday) return state.currentStreak;
  if (state.lastActiveDay === twoAgo && state.freezeAvailable) return state.currentStreak;
  return 0;
}
