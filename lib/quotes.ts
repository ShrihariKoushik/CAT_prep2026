// One line per day, picked deterministically from the IST date — same quote
// all day, new one tomorrow. Warm and lightly funny; never exam-pressure.
const QUOTES = [
  "Percentages fear you a little more every day.",
  "Somewhere an IIM classroom has a seat quietly holding your name.",
  "You vs. yesterday's you. That's the whole competition.",
  "Even Aryabhata needed rough work.",
  "Coffee first. Para-jumbles second. World domination by evening.",
  "The passage is long, but so is your patience. Barely. But it is.",
  "Streaks look good on you.",
  "One set a day keeps the panic away.",
  "Your future self is already bragging about today.",
  "Data interpretation: because someone has to tell the pie charts who's boss.",
  "Small steps. Loud results.",
  "Today's questions don't know what's coming for them.",
  "Brains are like levels here — they only go up with honest work. Yours is doing both.",
  "The calculator ban fears YOUR mental math now.",
  "Show up scrappy. That counts double.",
  "Somewhere a seating-arrangement puzzle is nervously rearranging itself.",
  "You've survived 100% of your hardest study days so far.",
  "Reading comprehension? You comprehend. Officially.",
  "A wrong answer today is a right answer with better timing.",
  "Quietly becoming unstoppable is a good look.",
  "The syllabus is finite. Your stubbornness is not.",
  "Time-speed-distance: you, quickly, to the top.",
  "Every explanation you read is one less trap that works on you.",
  "Discipline is just self-love with a timetable.",
  "The odd one out in today's crowd of aspirants? The one who actually showed up daily. Hi.",
  "Puzzles hate consistency. Keep being their problem.",
  "Your streak has a streak of its own now.",
  "Fifteen minutes of focus beats five hours of guilt.",
  "Verbal, Quant, LRDI — the trio that will one day tell people they knew you before you were famous.",
  "Keep going. The version of you at 99th percentile is taking notes.",
] as const;

export function quoteForDay(day: string): string {
  // simple stable hash of "YYYY-MM-DD"
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  return QUOTES[h % QUOTES.length];
}
