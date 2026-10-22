import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityEvents, assessmentQuestions, assessments, classrooms, learningResources, subjects } from "@/db/schema";
import { extractResourceText, parseTextbookOutline } from "@/lib/lesson-generator";
import { getSubjectQuestions } from "@/lib/curriculum-questions";

export type GeneratedQuestion = {
  tempId: string;
  questionText: string;
  options: string[];
  correctOption: number; // 0-based index
  points: number;
  explanation: string;
  topicTag?: string;
};

export type GeneratedAssessmentPlan = {
  title: string;
  instructions: string;
  type: "quiz" | "exercise" | "exam";
  maxScore: number;
  questions: GeneratedQuestion[];
};

/**
 * Builds curriculum-aligned, subject-specific multiple-choice questions
 * based on Ethiopian MoE textbook unit topics.
 */
export function generateCurriculumQuestions(
  unitTitle: string,
  topicTitle: string,
  subjectName: string,
  gradeName: string,
  questionCount = 3,
): GeneratedQuestion[] {
  const cleanTopic = topicTitle.replace(/^[0-9.:\-\s]+/, "").trim();
  const cleanUnit = unitTitle.replace(/^[0-9.:\-\s]+/, "").trim();

  // Get subject-specific templates from the curriculum question bank
  const templates = getSubjectQuestions(subjectName, cleanTopic, cleanUnit, gradeName);

  const questions: GeneratedQuestion[] = [];

  for (let i = 0; i < questionCount; i++) {
    const template = templates[i % templates.length];

    // Build shuffled options array
    const allOptions: string[] = [template.correct, ...template.distractors];

    // Pick a random position for the correct answer
    const correctIndex = Math.floor(Math.random() * 4);

    // Swap correct answer into the chosen position
    const tmp = allOptions[0];
    allOptions[0] = allOptions[correctIndex];
    allOptions[correctIndex] = tmp;

    questions.push({
      tempId: randomUUID(),
      questionText: template.prompt,
      options: allOptions,
      correctOption: correctIndex,
      points: 1,
      explanation: template.explanation,
      topicTag: cleanTopic,
    });
  }

  return questions;
}

/**
 * Generates an assessment (quiz, chapter test, or exercises) from an uploaded textbook.
 */
export async function generateTextbookAssessment(params: {
  schoolId: string;
  resourceId?: string;
  customText?: string;
  subjectName: string;
  gradeName: string;
  type: "quiz" | "exercise" | "exam";
  questionsPerTopic?: number;
  maxQuestions?: number;
}): Promise<GeneratedAssessmentPlan> {
  const {
    schoolId,
    resourceId,
    customText,
    subjectName,
    gradeName,
    type,
    questionsPerTopic = 2,
    maxQuestions = 15,
  } = params;

  let sourceText = customText?.trim() ?? "";
  let resourceTitle = "";

  if (resourceId) {
    try {
      const extracted = await extractResourceText(schoolId, resourceId);
      sourceText = `${extracted.text}\n\n${sourceText}`.trim();
      resourceTitle = extracted.fileName;
    } catch {
      // Fallback
    }
  }

  if (!sourceText) {
    sourceText = `Unit 1: Foundations of ${subjectName}
Topic 1: Principles and Definitions
Topic 2: Core Analytical Methods
Unit 2: Application and Synthesis
Topic 1: Practical Exercises and Analysis
Topic 2: Real-World Case Studies and Problem Solving`;
  }

  const units = parseTextbookOutline(sourceText, subjectName);
  const questions: GeneratedQuestion[] = [];

  for (const unit of units) {
    for (const topic of unit.topics) {
      if (questions.length >= maxQuestions) break;
      const count = Math.min(questionsPerTopic, maxQuestions - questions.length);
      const generated = generateCurriculumQuestions(unit.unitTitle, topic, subjectName, gradeName, count);
      questions.push(...generated);
    }
    if (questions.length >= maxQuestions) break;
  }

  const typeLabels: Record<string, string> = {
    quiz: "Quiz",
    exercise: "Review Exercises",
    exam: "Curriculum Examination",
  };

  const title = `${gradeName} ${subjectName} — ${typeLabels[type] ?? "Assessment"}${
    resourceTitle ? ` (${resourceTitle.replace(/\.[^/.]+$/, "")})` : ""
  }`;

  const instructions = `Instructions for Students:
1. Carefully read each question and all four available options before selecting your answer.
2. This assessment evaluates conceptual understanding, analytical application, and key terminology from the ${subjectName} curriculum.
3. Select the best answer for each question.
4. Total Points: ${questions.length} points. Passing Score: 70%.`;

  return {
    title,
    instructions,
    type,
    maxScore: questions.length,
    questions,
  };
}

/**
 * Saves a generated assessment and its questions directly into the database.
 */
export async function saveAssessmentWithQuestions(params: {
  schoolId: string;
  createdBy: string;
  academicYearId: string;
  classroomId: string;
  subjectId: string;
  title: string;
  instructions: string;
  status?: "draft" | "published" | "closed";
  questions: {
    questionText: string;
    options: string[];
    correctOption: number;
    points: number;
  }[];
}): Promise<{ assessmentId: string }> {
  const {
    schoolId,
    createdBy,
    academicYearId,
    classroomId,
    subjectId,
    title,
    instructions,
    status = "published",
    questions,
  } = params;

  const assessmentId = randomUUID();
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  await db.transaction(async (tx) => {
    await tx.insert(assessments).values({
      id: assessmentId,
      schoolId,
      createdBy,
      academicYearId,
      classroomId,
      subjectId,
      title,
      instructions,
      status,
      maxScore,
    });

    if (questions.length > 0) {
      await tx.insert(assessmentQuestions).values(
        questions.map((q, idx) => ({
          id: randomUUID(),
          assessmentId,
          questionText: q.questionText,
          options: q.options,
          correctOption: q.correctOption,
          points: q.points,
          sortOrder: idx,
        })),
      );
    }

    await tx.insert(activityEvents).values({
      schoolId,
      userId: createdBy,
      detail: `Auto-generated ${status} assessment from curriculum textbook: ${title}`,
    });
  });

  return { assessmentId };
}
