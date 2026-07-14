export type Section = "QUANT" | "VARC" | "LRDI";
export type Slot = "MORNING" | "AFTERNOON" | "EVENING";

export const SECTIONS: Section[] = ["QUANT", "VARC", "LRDI"];

export const SLOT_FOR_SECTION: Record<Section, Slot> = {
  QUANT: "MORNING",
  VARC: "AFTERNOON",
  LRDI: "EVENING",
};

export const SECTION_FOR_SLOT: Record<Slot, Section> = {
  MORNING: "QUANT",
  AFTERNOON: "VARC",
  EVENING: "LRDI",
};

export const SECTION_LABEL: Record<Section, string> = {
  QUANT: "Quantitative Aptitude",
  VARC: "Verbal Ability & RC",
  LRDI: "Logical Reasoning & DI",
};

export const SECTION_SHORT: Record<Section, string> = {
  QUANT: "Quant",
  VARC: "VARC",
  LRDI: "LRDI",
};

export const SLOT_LABEL: Record<Slot, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};

// CAT-realistic per-question timers (seconds)
export const TIMER_SECONDS: Record<Section, number> = {
  QUANT: 120,
  VARC: 90,
  LRDI: 120,
};

export const QUESTIONS_PER_SET = 8;
