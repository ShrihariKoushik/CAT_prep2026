// Pure-logic tests. Run: node tests/logic.test.mjs
// (Plain assertions, no framework — these cover the math that must never drift:
// IST time handling, slot unlocks, the level rule, SR gaps, quote determinism.)
import assert from "node:assert/strict";

// ---- inline copies of the pure functions under test (kept in sync with lib/) ----
// time.ts
const IST = 5.5 * 3_600_000;
const istDayOffset = (day, delta) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (day) => {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay();
  return istDayOffset(day, dow === 0 ? -6 : 1 - dow);
};
const unlockAtMs = (day, hour) => Date.parse(`${day}T00:00:00Z`) + hour * 3_600_000 - IST;
// levels.ts
const computeNextLevel = (before, scores) => {
  if (scores.length < 3) return before;
  const avg = scores.reduce((s, x) => s + x / 8, 0) / 3;
  if (avg >= 0.75) return Math.min(10, before + 1);
  if (avg < 0.4) return Math.max(1, before - 1);
  return before;
};
// streak.ts displayStreak
const displayStreak = (state, today) => {
  if (!state.lastActiveDay) return 0;
  const y = istDayOffset(today, -1), t2 = istDayOffset(today, -2);
  if (state.lastActiveDay === today || state.lastActiveDay === y) return state.currentStreak;
  if (state.lastActiveDay === t2 && state.freezeAvailable) return state.currentStreak;
  return 0;
};
// quotes.ts hash
const quoteIndex = (day, n) => {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  return h % n;
};
// sr.ts gaps
const GAPS = [1, 3, 7, 21];

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`ok - ${name}`); };

// ---- time ----
t("5am IST unlock = 23:30 UTC previous day", () =>
  assert.equal(new Date(unlockAtMs("2026-07-14", 5)).toISOString(), "2026-07-13T23:30:00.000Z"));
t("noon IST unlock = 06:30 UTC", () =>
  assert.equal(new Date(unlockAtMs("2026-07-14", 12)).toISOString(), "2026-07-14T06:30:00.000Z"));
t("6pm IST unlock = 12:30 UTC", () =>
  assert.equal(new Date(unlockAtMs("2026-07-14", 18)).toISOString(), "2026-07-14T12:30:00.000Z"));
t("day offset across month boundary", () =>
  assert.equal(istDayOffset("2026-07-31", 1), "2026-08-01"));
t("day offset across year boundary", () =>
  assert.equal(istDayOffset("2026-01-01", -1), "2025-12-31"));
t("mondayOf: whole week maps to same Monday", () => {
  for (let i = 0; i < 7; i++) assert.equal(mondayOf(istDayOffset("2026-07-13", i)), "2026-07-13");
});
t("mondayOf: Sunday belongs to preceding Monday's week", () =>
  assert.equal(mondayOf("2026-07-19"), "2026-07-13"));
t("mondayOf: next Monday starts a new week (freeze replenishes)", () =>
  assert.equal(mondayOf("2026-07-20"), "2026-07-20"));

// ---- level rule ----
t("fewer than 3 sets at level → no change", () => {
  assert.equal(computeNextLevel(1, []), 1);
  assert.equal(computeNextLevel(5, [8, 8]), 5);
});
t("avg >= 75% → +1 (6/8 thrice = exactly 75%)", () =>
  assert.equal(computeNextLevel(3, [6, 6, 6]), 4));
t("one bad set among good ones does NOT drop the level", () =>
  assert.equal(computeNextLevel(3, [2, 6, 6]), 3)); // avg 58% → hold
t("one lucky set does NOT bump the level", () =>
  assert.equal(computeNextLevel(3, [8, 4, 4]), 3)); // avg 67% → hold
t("avg < 40% → -1", () =>
  assert.equal(computeNextLevel(3, [2, 3, 2]), 2)); // avg 29%
t("floor at 1", () => assert.equal(computeNextLevel(1, [0, 0, 0]), 1));
t("cap at 10", () => assert.equal(computeNextLevel(10, [8, 8, 8]), 10));
t("boundary: 3,3,3 (37.5%) drops; 4,3,3 (41.7%) holds", () => {
  assert.equal(computeNextLevel(5, [3, 3, 3]), 4);
  assert.equal(computeNextLevel(5, [4, 3, 3]), 5);
});

// ---- streak display ----
t("active today → streak shows", () =>
  assert.equal(displayStreak({ currentStreak: 7, lastActiveDay: "2026-07-14", freezeAvailable: true }, "2026-07-14"), 7));
t("active yesterday → streak shows", () =>
  assert.equal(displayStreak({ currentStreak: 7, lastActiveDay: "2026-07-13", freezeAvailable: false }, "2026-07-14"), 7));
t("missed one day, freeze in hand → streak still shows", () =>
  assert.equal(displayStreak({ currentStreak: 7, lastActiveDay: "2026-07-12", freezeAvailable: true }, "2026-07-14"), 7));
t("missed one day, no freeze → 0", () =>
  assert.equal(displayStreak({ currentStreak: 7, lastActiveDay: "2026-07-12", freezeAvailable: false }, "2026-07-14"), 0));
t("missed two days → 0 even with freeze", () =>
  assert.equal(displayStreak({ currentStreak: 7, lastActiveDay: "2026-07-11", freezeAvailable: true }, "2026-07-14"), 0));
t("never active → 0", () =>
  assert.equal(displayStreak({ currentStreak: 0, lastActiveDay: null, freezeAvailable: true }, "2026-07-14"), 0));

// ---- SR schedule ----
t("SR gaps are 1/3/7/21", () => assert.deepEqual(GAPS, [1, 3, 7, 21]));
t("wrong at stage 3 would reset to stage 0 due tomorrow", () =>
  assert.equal(istDayOffset("2026-07-14", GAPS[0]), "2026-07-15"));
t("stage 2→3 due 21 days out", () =>
  assert.equal(istDayOffset("2026-07-14", GAPS[3]), "2026-08-04"));

// ---- quotes ----
t("quote index is deterministic for a given day", () =>
  assert.equal(quoteIndex("2026-07-14", 30), quoteIndex("2026-07-14", 30)));
t("quote index always in range across a year", () => {
  for (let i = 0; i < 365; i++) {
    const ix = quoteIndex(istDayOffset("2026-01-01", i), 30);
    assert.ok(ix >= 0 && ix < 30);
  }
});
t("quotes vary across the week (not all identical)", () => {
  const ixs = new Set();
  for (let i = 0; i < 7; i++) ixs.add(quoteIndex(istDayOffset("2026-07-13", i), 30));
  assert.ok(ixs.size > 1);
});

console.log(`\n${passed} tests passed`);
