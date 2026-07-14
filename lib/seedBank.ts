// Hardcoded emergency sets (level 1), served when generation fails.
// Keys are hand-verified. Each fallback day gets fresh rows (marked isSeed)
// so archive/SR behave normally.
import { prisma } from "./prisma";
import { SLOT_FOR_SECTION, type Section } from "./types";

type SeedContext = { kind: string; title: string; body: string; order: number };
type SeedQuestion = {
  kind: string;
  topic: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  contextOrder?: number; // index into contexts
};

const QUANT_SEED: SeedQuestion[] = [
  {
    kind: "MCQ", topic: "percentages",
    text: "What is 20% of 150?",
    options: ["25", "30", "35", "45"],
    correctIndex: 1,
    explanation: "20% = 1/5, and 150 ÷ 5 = 30. Option A (25) comes from taking 1/6 instead of 1/5. Option C (35) is a plain arithmetic slip. Option D (45) is 30% of 150 — misreading the percentage.",
  },
  {
    kind: "MCQ", topic: "ratio-proportion-variation",
    text: "Two numbers are in the ratio 3 : 5 and their sum is 64. What is the smaller number?",
    options: ["24", "40", "32", "20"],
    correctIndex: 0,
    explanation: "3 + 5 = 8 parts, so each part = 64 ÷ 8 = 8. Smaller = 3 × 8 = 24. Option B (40) is the larger number. Option C (32) is half the sum — ignoring the ratio. Option D (20) comes from using 16 parts by mistake... it doesn't fit any consistent split of 64 in 3:5.",
  },
  {
    kind: "MCQ", topic: "time-speed-distance",
    text: "A car covers 60 km in 45 minutes. What is its speed in km/h?",
    options: ["75", "80", "90", "72"],
    correctIndex: 1,
    explanation: "45 min = 3/4 hour, so speed = 60 ÷ (3/4) = 80 km/h. Option A (75) and D (72) are near-miss arithmetic slips. Option C (90) comes from wrongly scaling 60 by 1.5 instead of 4/3.",
  },
  {
    kind: "MCQ", topic: "averages",
    text: "The average of five numbers is 18. Four of them are 15, 20, 22 and 10. What is the fifth number?",
    options: ["23", "18", "25", "20"],
    correctIndex: 0,
    explanation: "Total = 5 × 18 = 90. The four given sum to 67, so the fifth = 90 − 67 = 23. Option B (18) assumes the fifth equals the average — only true if the others already average 18. Options C and D are arithmetic slips in the subtraction.",
  },
  {
    kind: "MCQ", topic: "simple-compound-interest",
    text: "What is the simple interest on ₹5,000 at 8% per annum for 3 years?",
    options: ["₹1,200", "₹1,240", "₹400", "₹1,300"],
    correctIndex: 0,
    explanation: "SI = P·R·T/100 = 5000 × 8 × 3 / 100 = ₹1,200. Option B is compound interest territory — SI doesn't compound. Option C (₹400) is one year's interest, forgetting T = 3. Option D is a plain slip.",
  },
  {
    kind: "MCQ", topic: "hcf-lcm",
    text: "What is the LCM of 12 and 18?",
    options: ["36", "72", "6", "54"],
    correctIndex: 0,
    explanation: "12 = 2²·3, 18 = 2·3². LCM takes the highest powers: 2²·3² = 36. Option B (72) over-multiplies (12 × 18 ÷ 3 instead of ÷ 6). Option C (6) is the HCF, not the LCM. Option D (54) misses the factor 2².",
  },
  {
    kind: "MCQ", topic: "mensuration-2d",
    text: "A rectangle has perimeter 36 cm and length 10 cm. What is its area?",
    options: ["80 cm²", "90 cm²", "72 cm²", "60 cm²"],
    correctIndex: 0,
    explanation: "Perimeter 36 → length + breadth = 18 → breadth = 8. Area = 10 × 8 = 80. Option B uses breadth 9 (halving 18 without subtracting length). Option C uses breadth 7.2 from a slip. Option D uses breadth 6 (treating 36 as the semi-perimeter).",
  },
  {
    kind: "MCQ", topic: "linear-equations",
    text: "If 3x − 7 = 14, what is x?",
    options: ["7", "3", "21", "5"],
    correctIndex: 0,
    explanation: "3x = 21, so x = 7. Option C (21) stops before dividing by 3. Option B (3) divides 21 by 7 instead of 3. Option D comes from subtracting 7 instead of adding: 3x = 7 gives nothing clean — a sign-error path.",
  },
];

const VARC_CONTEXTS: SeedContext[] = [
  {
    kind: "RC_PASSAGE", order: 0,
    title: "The Attention Economy",
    body: "The scarcest resource in a modern economy is no longer capital or labour but attention. Digital platforms compete not for our money directly but for our time, which they convert into advertising revenue. This inversion has consequences that classical economics struggles to describe. When attention is the commodity, the incentive is not to satisfy the consumer but to retain them — and retention is best achieved not by contentment but by mild, perpetual dissatisfaction. A feed that fully satisfied you would end your scrolling; one that almost satisfies you keeps you searching.\n\nCritics argue this framing is too cynical: people freely choose these platforms, and revealed preference suggests they derive value from them. But the choice argument assumes preferences are formed independently of the systems that serve them, which is precisely what attention markets undermine. When an algorithm learns what weakens your resolve faster than you learn what strengthens it, the market is no longer a neutral matchmaker between stable preferences and products. It is a participant in manufacturing the preferences themselves.\n\nThis does not mean regulation is straightforward. Attention, unlike tobacco, has no dosage; the same hour of use can be enriching for one person and corrosive for another. The honest conclusion is uncomfortable for both sides: the market for attention is real, novel, and not self-correcting — yet the tools we have for correcting markets were built for commodities that behave nothing like it.",
  },
];

const VARC_SEED: SeedQuestion[] = [
  {
    kind: "RC_PASSAGE_MCQ", topic: "main-idea", contextOrder: 0,
    text: "Which of the following best captures the passage's central claim?",
    options: [
      "Attention markets are novel and problematic, but existing regulatory tools fit them poorly",
      "Digital platforms should be regulated like tobacco companies",
      "People derive no real value from digital platforms",
      "Classical economics fully explains platform behaviour",
    ],
    correctIndex: 0,
    explanation: "The passage argues attention markets are real, novel, not self-correcting — and that our correction tools don't fit (final paragraph). Option B is explicitly resisted ('attention, unlike tobacco, has no dosage'). Option C is too extreme — the author concedes use 'can be enriching'. Option D contradicts the first paragraph, which says classical economics 'struggles to describe' this.",
  },
  {
    kind: "RC_PASSAGE_MCQ", topic: "inference", contextOrder: 0,
    text: "According to the passage, why do platforms benefit from 'mild, perpetual dissatisfaction'?",
    options: [
      "A fully satisfied user stops engaging, ending the attention supply",
      "Dissatisfied users pay more for premium features",
      "Advertisers prefer unhappy audiences",
      "It reduces the platform's content costs",
    ],
    correctIndex: 0,
    explanation: "Directly stated: 'A feed that fully satisfied you would end your scrolling.' Options B, C and D introduce mechanisms (payments, advertiser psychology, costs) the passage never mentions — all out of scope.",
  },
  {
    kind: "RC_PASSAGE_MCQ", topic: "author-agreement", contextOrder: 0,
    text: "The author would most likely agree that the 'revealed preference' defence of platforms is:",
    options: [
      "Circular, because the platforms shape the very preferences being revealed",
      "Correct, because choice is always evidence of value",
      "Irrelevant to economic analysis",
      "Persuasive only for older users",
    ],
    correctIndex: 0,
    explanation: "The author says the choice argument 'assumes preferences are formed independently of the systems that serve them, which is precisely what attention markets undermine' — a circularity objection. Option B is the critics' view, which the author rebuts. Options C and D are never suggested — out of scope.",
  },
  {
    kind: "RC_PASSAGE_MCQ", topic: "function-in-context", contextOrder: 0,
    text: "The comparison with tobacco serves to:",
    options: [
      "Show why regulating attention is harder than regulating a conventional harmful good",
      "Argue that platforms are as harmful as smoking",
      "Recommend a dosage-based limit on screen time",
      "Dismiss all regulation as impossible",
    ],
    correctIndex: 0,
    explanation: "Tobacco appears in the sentence about why regulation 'is not straightforward': attention 'has no dosage'. It marks a disanalogy, not an equivalence — so option B distorts. Option C inverts the point (no dosage exists). Option D is too extreme: 'not straightforward' is not 'impossible'.",
  },
  {
    kind: "RC_PASSAGE_MCQ", topic: "application", contextOrder: 0,
    text: "Which finding, if true, would most weaken the author's argument?",
    options: [
      "Users' stated preferences remain stable and unchanged even after years of heavy algorithmic exposure",
      "Platforms earn most revenue from advertising",
      "Some users report enjoying their feeds",
      "Attention is difficult to measure precisely",
    ],
    correctIndex: 0,
    explanation: "The core claim is that algorithms manufacture preferences. Stable preferences under heavy exposure would undercut exactly that. Option B supports the passage's setup. Option C is already conceded ('enriching for one person'). Option D is compatible with the argument — measurement difficulty isn't preference stability.",
  },
  {
    kind: "PARA_JUMBLE", topic: "para-jumble",
    text: "Arrange the four sentences into a coherent paragraph:\nA. The result was a decade of cheap credit that inflated asset prices worldwide.\nB. Central banks responded to the 2008 crisis by cutting interest rates to historic lows.\nC. When rates finally rose, those inflated assets proved painfully fragile.\nD. Investors, starved of yield on safe assets, moved into riskier ones.",
    options: ["BDAC", "BADC", "ABDC", "DBAC"],
    correctIndex: 0,
    explanation: "B sets the cause (rate cuts), D gives the mechanism (yield-starved investors take risk), A states the result (inflated prices), C delivers the consequence (fragility when rates rose). BADC breaks the causal chain — the 'result' in A needs D's mechanism first. ABDC opens with a 'result' that has no antecedent. DBAC has investors reacting before the rate cuts exist.",
  },
  {
    kind: "PARA_SUMMARY", topic: "para-summary",
    text: "Choose the best summary:\n\"Handwriting notes forces a student to compress and rephrase, because no one can transcribe speech verbatim by hand. Typing, being fast enough for near-transcription, removes that pressure. Studies accordingly find that laptop note-takers capture more words but retain less meaning, while handwriters capture fewer words and understand more.\"",
    options: [
      "Handwriting aids retention because its slowness forces active summarising, which typing's speed removes",
      "Students should be banned from using laptops in classrooms",
      "Typing captures more words than handwriting",
      "Note-taking of any kind improves memory",
    ],
    correctIndex: 0,
    explanation: "The paragraph's point is the mechanism: slowness → compression → understanding. Option B draws a policy conclusion the text never makes — too far. Option C is true but only a detail, not the point. Option D is too broad — the paragraph contrasts two methods, it doesn't endorse note-taking generally.",
  },
  {
    kind: "ODD_ONE_OUT", topic: "odd-one-out",
    text: "Three sentences form a coherent paragraph; one does not belong. Identify it.\nA. The Green Revolution introduced high-yield wheat varieties to India in the 1960s.\nB. Fertiliser and irrigation demands of the new varieties reshaped Punjab's agriculture.\nC. Monsoon prediction models have improved with satellite data.\nD. Food-grain output rose sharply, ending the era of chronic import dependence.",
    options: ["Sentence C", "Sentence A", "Sentence B", "Sentence D"],
    correctIndex: 0,
    explanation: "A, B and D narrate the Green Revolution: its arrival, its input demands, its output effect. C is about weather forecasting technology — agriculture-adjacent, which is what makes it tempting, but it plays no role in the Green Revolution storyline. A, B and D each connect causally; C connects only by theme.",
  },
];

const LRDI_CONTEXTS: SeedContext[] = [
  {
    kind: "LRDI_SCENARIO", order: 0,
    title: "Four friends in a row",
    body: "Four friends — Asha, Bala, Chitra and Dev — sit in a row of 4 seats facing north, positions 1 (leftmost) to 4 (rightmost).\nClues:\n1. Chitra sits at position 1.\n2. Bala sits immediately to the right of Asha.\n3. Dev is not adjacent to Bala.",
  },
  {
    kind: "LRDI_SCENARIO", order: 1,
    title: "Bookshop monthly sales",
    body: "Monthly book sales at a shop:\nJan: 120 | Feb: 150 | Mar: 90 | Apr: 140",
  },
];

const LRDI_SEED: SeedQuestion[] = [
  {
    kind: "MCQ", topic: "linear-seating-arrangement", contextOrder: 0,
    text: "Who sits at position 4 (far right)?",
    options: ["Bala", "Asha", "Dev", "Chitra"],
    correctIndex: 0,
    explanation: "Chitra takes 1. Asha-Bala must occupy consecutive seats with Bala right: (2,3) or (3,4). If (2,3), Dev gets 4 — adjacent to Bala at 3, violating clue 3. So Asha 3, Bala 4, Dev 2. Order: Chitra, Dev, Asha, Bala. Bala is at 4. Every other option contradicts the forced arrangement.",
  },
  {
    kind: "MCQ", topic: "linear-seating-arrangement", contextOrder: 0,
    text: "Who sits second from the left?",
    options: ["Dev", "Asha", "Bala", "Chitra"],
    correctIndex: 0,
    explanation: "The unique arrangement is Chitra-Dev-Asha-Bala (see the deduction: Asha-Bala can't be at 2-3 or Dev would touch Bala). Position 2 is Dev. Asha is 3rd, Bala 4th, Chitra 1st.",
  },
  {
    kind: "MCQ", topic: "linear-seating-arrangement", contextOrder: 0,
    text: "Who sits between Dev and Bala?",
    options: ["Asha", "Chitra", "No one", "Both Asha and Chitra"],
    correctIndex: 0,
    explanation: "In Chitra(1)-Dev(2)-Asha(3)-Bala(4), the only seat between Dev and Bala is 3 — Asha. Chitra is on the far side of Dev. 'No one' would require Dev and Bala adjacent, which clue 3 forbids.",
  },
  {
    kind: "MCQ", topic: "linear-seating-arrangement", contextOrder: 0,
    text: "Which pair is NOT sitting in adjacent seats?",
    options: ["Bala and Dev", "Chitra and Dev", "Dev and Asha", "Asha and Bala"],
    correctIndex: 0,
    explanation: "Adjacent pairs in Chitra-Dev-Asha-Bala are (Chitra, Dev), (Dev, Asha), (Asha, Bala). Bala (4) and Dev (2) are two seats apart — exactly what clue 3 demanded, so this is also checkable without the full solve.",
  },
  {
    kind: "MCQ", topic: "table-based-di", contextOrder: 1,
    text: "In which month were sales highest?",
    options: ["Feb", "Jan", "Apr", "Mar"],
    correctIndex: 0,
    explanation: "150 (Feb) > 140 (Apr) > 120 (Jan) > 90 (Mar). Apr is the trap for anyone scanning right-to-left and stopping at the first big number.",
  },
  {
    kind: "MCQ", topic: "table-based-di", contextOrder: 1,
    text: "What were the total sales across the four months?",
    options: ["500", "480", "520", "510"],
    correctIndex: 0,
    explanation: "120 + 150 + 90 + 140 = 500. The wrong options are one-slip sums: 480 drops 20 (misreading 140 as 120), 520 double-counts 20, 510 misreads 90 as 100.",
  },
  {
    kind: "MCQ", topic: "table-based-di", contextOrder: 1,
    text: "What was the percentage increase in sales from Jan to Feb?",
    options: ["25%", "30%", "20%", "35%"],
    correctIndex: 0,
    explanation: "Increase = 30 on a base of 120 → 30/120 = 25%. Choosing 20% comes from using Feb (150) as the base — the classic percentage-change error. 30% treats the increase as 30 'points'. 35% is a slip.",
  },
  {
    kind: "MCQ", topic: "table-based-di", contextOrder: 1,
    text: "What was the average monthly sales figure?",
    options: ["125", "120", "130", "135"],
    correctIndex: 0,
    explanation: "500 ÷ 4 = 125. 120 anchors on Jan's value; 130 and 135 are division slips. If you already computed the total in the previous question, this is a one-step read.",
  },
];

const SEEDS: Record<Section, { contexts: SeedContext[]; questions: SeedQuestion[] }> = {
  QUANT: { contexts: [], questions: QUANT_SEED },
  VARC: { contexts: VARC_CONTEXTS, questions: VARC_SEED },
  LRDI: { contexts: LRDI_CONTEXTS, questions: LRDI_SEED },
};

/** Create (idempotently) a FALLBACK set for day+section from the seed bank. */
export async function createFallbackSet(day: string, section: Section) {
  const existing = await prisma.questionSet.findUnique({
    where: { day_section: { day, section } },
  });
  if (existing) return existing;

  try {
    return await createFallbackSetInner(day, section);
  } catch (e: unknown) {
    // Unique-constraint race: a concurrent request created it first — that's fine.
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return prisma.questionSet.findUnique({ where: { day_section: { day, section } } });
    }
    throw e;
  }
}

async function createFallbackSetInner(day: string, section: Section) {
  const seed = SEEDS[section];
  return prisma.$transaction(async (tx) => {
    const set = await tx.questionSet.create({
      data: {
        day, section,
        slot: SLOT_FOR_SECTION[section],
        difficulty: 1,
        status: "FALLBACK",
        isFallback: true,
        model: "seed-bank",
        promptTopics: "[]", // seed topics don't count against the no-repeat window
      },
    });
    const contextIds: string[] = [];
    for (const c of seed.contexts) {
      const ctx = await tx.contextBlock.create({
        data: { setId: set.id, kind: c.kind, title: c.title, body: c.body, order: c.order },
      });
      contextIds.push(ctx.id);
    }
    await Promise.all(
      seed.questions.map((q, i) =>
        tx.question.create({
          data: {
            setId: set.id,
            contextId: q.contextOrder != null ? contextIds[q.contextOrder] : null,
            isSeed: true,
            section,
            difficulty: 1,
            kind: q.kind,
            topic: q.topic,
            orderInSet: i,
            text: q.text,
            options: JSON.stringify(q.options),
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            verified: true, // hand-verified
          },
        })
      )
    );
    return set;
  });
}
