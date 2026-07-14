// Streak + freeze + day rollup, per user. Only FRESH set completions call in —
// Redo Mistakes never touches the streak. Freeze: one per calendar week,
// boundary Monday 00:00 IST; covers exactly one missed day.
import { prisma } from "./prisma";
import { istDayOffset, mondayOf } from "./time";

export async function replenishFreeze(userId: string, today: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const monday = mondayOf(today);
  if (user.freezeResetWeek !== monday) {
    return prisma.user.update({
      where: { id: userId },
      data: { freezeAvailable: true, freezeResetWeek: monday },
    });
  }
  return user;
}

export async function registerSessionCompletion(
  userId: string,
  today: string,
  answered: number,
  correct: number,
) {
  const user = await replenishFreeze(userId, today);

  const log = await prisma.dayLog.upsert({
    where: { day_userId: { day: today, userId } },
    create: { day: today, userId, sessionsCompleted: 1, questionsAnswered: answered },
    update: {
      sessionsCompleted: { increment: 1 },
      questionsAnswered: { increment: answered },
    },
  });

  const data: Record<string, unknown> = {
    totalAnswered: { increment: answered },
    totalCorrect: { increment: correct },
  };

  if (log.sessionsCompleted === 1) {
    const yesterday = istDayOffset(today, -1);
    const twoAgo = istDayOffset(today, -2);
    let streak: number;

    if (user.lastActiveDay === today) {
      streak = user.currentStreak;
    } else if (user.lastActiveDay === yesterday) {
      streak = user.currentStreak + 1;
    } else if (user.lastActiveDay === twoAgo && user.freezeAvailable) {
      streak = user.currentStreak + 1;
      data.freezeAvailable = false;
      await prisma.dayLog.upsert({
        where: { day_userId: { day: yesterday, userId } },
        create: { day: yesterday, userId, freezeUsed: true },
        update: { freezeUsed: true },
      });
    } else {
      streak = 1;
    }

    data.currentStreak = streak;
    data.longestStreak = Math.max(user.longestStreak, streak);
    data.lastActiveDay = today;
  }

  return prisma.user.update({ where: { id: userId }, data: data as never });
}

/** Streak as it should display right now (state only updates on completions). */
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
