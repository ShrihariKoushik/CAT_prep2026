// All scheduling is pinned to IST (Asia/Kolkata, UTC+5:30, no DST) regardless
// of server or device timezone. "Day" = IST calendar date as "YYYY-MM-DD".
import type { Slot } from "./types";

export const IST_OFFSET_MS = 5.5 * 3_600_000;

/** A Date whose UTC getters read IST wall-clock time. */
export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

export function istToday(): string {
  return istNow().toISOString().slice(0, 10);
}

export function istDayOffset(day: string, deltaDays: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** Monday ("YYYY-MM-DD") of the IST week containing `day`. Freeze reset boundary. */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sun
  return istDayOffset(day, dow === 0 ? -6 : 1 - dow);
}

export const SLOT_UNLOCK_HOUR: Record<Slot, number> = {
  MORNING: 5,
  AFTERNOON: 12,
  EVENING: 18,
};

/** Real epoch-ms at which `slot` unlocks on IST day `day`. */
export function unlockAtMs(day: string, slot: Slot): number {
  return Date.parse(`${day}T00:00:00Z`) + SLOT_UNLOCK_HOUR[slot] * 3_600_000 - IST_OFFSET_MS;
}

/** Real epoch-ms of IST midnight at the END of `day` (when open sessions expire to archive). */
export function endOfDayMs(day: string): number {
  return Date.parse(`${istDayOffset(day, 1)}T00:00:00Z`) - IST_OFFSET_MS;
}

export function istHourNow(): number {
  const n = istNow();
  return n.getUTCHours() + n.getUTCMinutes() / 60;
}
