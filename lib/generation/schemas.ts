import { z } from "zod";

export const GeneratedQuestionZ = z.object({
  topic: z.string().min(2),
  kind: z.string().min(2),
  text: z.string().min(10),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(30),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionZ>;

export const QuantOutZ = z.object({
  questions: z.array(GeneratedQuestionZ).length(10),
});

const wordCount = (s: string) => s.trim().split(/\s+/).length;

export const VarcOutZ = z.object({
  passage: z.object({
    topicArea: z.enum(["economics", "philosophy", "science", "history", "sociology"]),
    title: z.string().min(3),
    body: z.string().refine((b) => wordCount(b) >= 260 && wordCount(b) <= 400, {
      message: "passage body must be 300-350 words (260-400 accepted)",
    }),
  }),
  rcQuestions: z.array(GeneratedQuestionZ).length(5),
  standaloneQuestions: z.array(GeneratedQuestionZ).length(3),
});

export const LrdiOutZ = z.object({
  miniSets: z
    .array(
      z.object({
        type: z.string().min(2),
        scenario: z.object({ title: z.string().min(3), body: z.string().min(40) }),
        questions: z.array(GeneratedQuestionZ).length(5),
      })
    )
    .length(2),
});
