// What Claude writes for each kind of teaching material, as zod schemas: the API is asked for JSON
// matching the schema (structured outputs), and the same schema types the stored `content`.
import { z } from "zod";

export const MATERIAL_KINDS = ["lesson_plan", "lecture_notes", "assignment", "exam"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const MATERIAL_LABELS: Record<MaterialKind, string> = {
  lesson_plan: "Lesson plan",
  lecture_notes: "Lecture notes",
  assignment: "Assignment",
  exam: "Exam",
};

// Quality runs on Claude Opus 5.5; economy on Claude Sonnet 5.5 at half the token price.
export const AI_MODELS = {
  quality: { id: "claude-opus-5-5", label: "Best quality (Claude Opus 5.5)" },
  economy: { id: "claude-sonnet-5-5", label: "Lower cost (Claude Sonnet 5.5)" },
} as const;
export type AiModelChoice = keyof typeof AI_MODELS;

/** US$ per million tokens: input, cache read, output. */
export const MODEL_PRICES: Record<string, { input: number; cacheRead: number; output: number }> = {
  "claude-opus-5-5": { input: 4, cacheRead: 0.2, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheRead: 0.2, output: 10 },
};

export const lessonPlanSchema = z.object({
  title: z.string(),
  unitTopic: z.string(),
  durationMinutes: z.number().int(),
  overview: z.string(),
  objectives: z.array(z.string()),
  materials: z.array(z.string()),
  prerequisites: z.string(),
  procedure: z.array(z.object({
    phase: z.string(),
    minutes: z.number().int(),
    teacherActivity: z.string(),
    studentActivity: z.string(),
  })),
  differentiation: z.string(),
  assessment: z.string(),
  homework: z.string(),
  textbookPages: z.string(),
});

export const lectureNotesSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })),
  reviewQuestions: z.array(z.string()),
  textbookPages: z.string(),
});

export const assignmentSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  tasks: z.array(z.object({ prompt: z.string(), marks: z.number().int(), expectedAnswer: z.string() })),
  rubric: z.string(),
  textbookPages: z.string(),
});

export const examSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  durationMinutes: z.number().int(),
  multipleChoice: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()),
    correctOption: z.number().int(),
    explanation: z.string(),
    points: z.number().int(),
  })),
  shortAnswer: z.array(z.object({ question: z.string(), marks: z.number().int(), modelAnswer: z.string() })),
  textbookPages: z.string(),
});

export const MATERIAL_SCHEMAS = {
  lesson_plan: lessonPlanSchema,
  lecture_notes: lectureNotesSchema,
  assignment: assignmentSchema,
  exam: examSchema,
} as const;

export type MaterialContent = {
  lesson_plan: z.infer<typeof lessonPlanSchema>;
  lecture_notes: z.infer<typeof lectureNotesSchema>;
  assignment: z.infer<typeof assignmentSchema>;
  exam: z.infer<typeof examSchema>;
};

const KIND_BRIEFS: Record<MaterialKind, string> = {
  lesson_plan:
    "Write one lesson plan for a single class period. Give measurable objectives, the materials needed (prefer low-cost ones an Ethiopian government school has), a timed procedure from introduction to closure whose minutes add up to the duration, support for slower and faster learners, how the teacher checks understanding, and homework drawn from the textbook's exercises.",
  lecture_notes:
    "Write lecture notes a teacher can present from and students can copy into their exercise books: a short summary, sections that explain the content step by step with worked examples where the textbook has them, the key terms with definitions, and review questions.",
  assignment:
    "Write a homework or class assignment with 4 to 8 tasks of increasing difficulty, marks for each, the expected answer or marking points for each, and a short rubric. Tasks should ask students to apply the content, not only recall it.",
  exam:
    "Write an exam with 10 to 20 multiple-choice questions (exactly four options each, one correct; give its zero-based index as correctOption and a one-sentence explanation) and 2 to 5 short-answer questions with model answers. Cover the scope evenly, mix recall, understanding and application, and avoid trick questions.",
};

export function systemPrompt() {
  return [
    "You are an experienced Ethiopian teacher and teacher-trainer who prepares teaching material from the official Ministry of Education textbooks.",
    "Work only from the attached textbook: follow its content, sequence, terminology and examples, and say which pages you used in textbookPages. Do not add facts the textbook does not support.",
    "Write in the textbook's language of instruction (for example English, Amharic or Afaan Oromo) unless the teacher asks for another language.",
    "Pitch the material at the textbook's grade level, and keep it practical for large classes with few resources.",
    "Write plain text in each field. Use short paragraphs; separate list items with new lines rather than markdown symbols.",
  ].join("\n");
}

export function taskPrompt(params: { kind: MaterialKind; scope: string; gradeName?: string | null; subjectName?: string | null; instructions?: string | null }) {
  const lines = [
    `Task: ${KIND_BRIEFS[params.kind]}`,
    `Scope in the textbook: ${params.scope}`,
  ];
  if (params.gradeName || params.subjectName) lines.push(`Class: ${[params.gradeName, params.subjectName].filter(Boolean).join(", ")}`);
  if (params.instructions) lines.push(`The teacher's notes:\n${params.instructions}`);
  return lines.join("\n\n");
}

export function estimateCost(model: string, usage: { inputTokens: number | null; cachedInputTokens: number | null; outputTokens: number | null }) {
  const price = MODEL_PRICES[model];
  if (!price || usage.inputTokens === null || usage.outputTokens === null) return null;
  return (usage.inputTokens * price.input + (usage.cachedInputTokens ?? 0) * price.cacheRead + usage.outputTokens * price.output) / 1_000_000;
}
