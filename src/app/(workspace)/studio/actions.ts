"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/db";
import {
  academicYears,
  activityEvents,
  assessmentQuestions,
  assessments,
  classrooms,
  generatedMaterials,
  learningResources,
  lessonPlanRevisions,
  lessonPlans,
  teachers,
} from "@/db/schema";
import { aiConfigured, aiReadableResource, runGeneration } from "@/lib/ai-generation";
import { AI_MODELS, MATERIAL_KINDS, MATERIAL_LABELS, type AiModelChoice, type MaterialContent, type MaterialKind } from "@/lib/ai-materials";
import { requireSchoolRole } from "@/lib/permissions";

const STAFF = ["school_admin", "teacher"] as const;

async function startGenerationImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const resourceId = String(formData.get("resourceId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as MaterialKind;
  const scope = String(formData.get("scope") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const modelChoice = String(formData.get("model") ?? "quality") as AiModelChoice;

  if (!aiConfigured()) return { error: "AI generation isn't set up: the server has no ANTHROPIC_API_KEY." };
  if (!schoolId || !resourceId) return { error: "Choose a textbook from the library." };
  if (!MATERIAL_KINDS.includes(kind)) return { error: "Choose what to prepare." };
  if (!scope || scope.length > 200) return { error: "Say which unit, lesson or pages to cover, in 200 characters or fewer." };
  if (instructions.length > 2000) return { error: "Keep your notes under 2,000 characters." };
  if (!(modelChoice in AI_MODELS)) return { error: "Choose a model." };
  const { session } = await requireSchoolRole(schoolId, STAFF);

  const [resource] = await db.select({
    title: learningResources.title,
    fileName: learningResources.fileName,
    gradeLevelId: learningResources.gradeLevelId,
    subjectId: learningResources.subjectId,
  }).from(learningResources)
    .where(and(eq(learningResources.id, resourceId), eq(learningResources.schoolId, schoolId)))
    .limit(1);
  if (!resource) return { error: "That textbook isn't in this school's library." };
  if (!aiReadableResource(resource.fileName)) return { error: "Claude can read PDF and text files. Choose a PDF textbook." };

  const materialId = randomUUID();
  await db.insert(generatedMaterials).values({
    id: materialId,
    schoolId,
    resourceId,
    gradeLevelId: resource.gradeLevelId,
    subjectId: resource.subjectId,
    createdBy: session.user.id,
    kind,
    scope,
    instructions: instructions || null,
    title: `${MATERIAL_LABELS[kind]}: ${scope}`.slice(0, 200),
    model: AI_MODELS[modelChoice].id,
  });
  // Claude can take a few minutes over a whole textbook, longer than a proxy waits for a reply:
  // the page opens at once and refreshes until the material is ready.
  after(() => runGeneration(materialId));
  redirect(`/studio/${materialId}`);
}

async function loadMaterial(materialId: string) {
  const [material] = await db.select().from(generatedMaterials).where(eq(generatedMaterials.id, materialId)).limit(1);
  if (!material) throw new UserError("That material no longer exists.");
  const access = await requireSchoolRole(material.schoolId, STAFF);
  const mayChange = access.role === "platform_admin" || access.role === "school_admin" || material.createdBy === access.session.user.id;
  return { material, ...access, mayChange };
}

async function retryGenerationImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { material, mayChange } = await loadMaterial(String(formData.get("materialId") ?? ""));
  if (!mayChange) throw new UserError("Only the teacher who asked for this material, or a school admin, can retry it.");
  if (material.status !== "failed" && material.status !== "generating") throw new UserError("This material is already written.");
  if (!aiConfigured()) throw new UserError("AI generation isn't set up: the server has no ANTHROPIC_API_KEY.");
  await db.update(generatedMaterials).set({ status: "generating", error: null }).where(eq(generatedMaterials.id, material.id));
  after(() => runGeneration(material.id));
  revalidatePath(`/studio/${material.id}`);
  return {};
}

async function approveMaterialImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { material, role, session } = await loadMaterial(String(formData.get("materialId") ?? ""));
  if (role !== "school_admin" && role !== "platform_admin") throw new UserError("Only school admins approve material.");
  if (material.status !== "ready") throw new UserError("Only finished material can be approved.");
  await db.transaction(async (tx) => {
    await tx.update(generatedMaterials).set({ status: "approved" }).where(eq(generatedMaterials.id, material.id));
    await tx.insert(activityEvents).values({ schoolId: material.schoolId, userId: session.user.id, detail: `Approved ${material.title}`.slice(0, 255) });
  });
  revalidatePath(`/studio/${material.id}`);
  revalidatePath("/studio");
  return {};
}

async function deleteMaterialImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { material, mayChange } = await loadMaterial(String(formData.get("materialId") ?? ""));
  if (!mayChange) throw new UserError("Only the teacher who asked for this material, or a school admin, can delete it.");
  await db.delete(generatedMaterials).where(eq(generatedMaterials.id, material.id));
  revalidatePath("/studio");
  redirect("/studio");
}

async function currentYearId(schoolId: string) {
  const [year] = await db.select({ id: academicYears.id }).from(academicYears)
    .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true))).limit(1);
  if (!year) throw new UserError("Set a current academic year under Academic setup first.");
  return year.id;
}

const lines = (items: string[]) => items.map((item) => `• ${item}`).join("\n");

async function saveAsLessonPlanImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { material, session } = await loadMaterial(String(formData.get("materialId") ?? ""));
  if (material.kind !== "lesson_plan" || (material.status !== "ready" && material.status !== "approved")) {
    throw new UserError("Only a finished lesson plan can be saved to Lesson plans.");
  }
  if (material.lessonPlanId) redirect(`/lessons/${material.lessonPlanId}`);
  if (!material.gradeLevelId || !material.subjectId) {
    throw new UserError("The textbook isn't linked to a grade and subject, so the lesson can't be filed. Link it under Resources.");
  }
  const academicYearId = await currentYearId(material.schoolId);
  const plan = material.content as MaterialContent["lesson_plan"];
  const [teacher] = await db.select({ id: teachers.id }).from(teachers)
    .where(and(eq(teachers.schoolId, material.schoolId), eq(teachers.userId, session.user.id))).limit(1);

  const fields = {
    title: plan.title.slice(0, 200),
    unitTopic: plan.unitTopic.slice(0, 160) || null,
    durationMinutes: plan.durationMinutes > 0 ? plan.durationMinutes : 45,
    status: "draft" as const,
    overview: plan.overview,
    objectives: lines(plan.objectives),
    materials: lines(plan.materials),
    prerequisites: plan.prerequisites,
    procedures: plan.procedure
      .map((step) => `${step.phase} (${step.minutes} min)\nTeacher: ${step.teacherActivity}\nStudents: ${step.studentActivity}`)
      .join("\n\n"),
    differentiation: plan.differentiation,
    assessment: plan.assessment,
    homework: plan.homework,
    notes: `Prepared with Claude from the textbook (${plan.textbookPages}). Review before teaching.`,
  };
  const lessonId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(lessonPlans).values({
      id: lessonId,
      schoolId: material.schoolId,
      academicYearId,
      gradeLevelId: material.gradeLevelId!,
      subjectId: material.subjectId!,
      teacherId: teacher?.id ?? null,
      sourceResourceId: material.resourceId,
      createdBy: session.user.id,
      ...fields,
    });
    await tx.insert(lessonPlanRevisions).values({
      schoolId: material.schoolId,
      lessonPlanId: lessonId,
      version: 1,
      editedBy: session.user.id,
      changeSummary: "Created from AI Studio",
      ...fields,
    });
    await tx.update(generatedMaterials).set({ lessonPlanId: lessonId }).where(eq(generatedMaterials.id, material.id));
    await tx.insert(activityEvents).values({ schoolId: material.schoolId, userId: session.user.id, detail: `Created lesson plan: ${fields.title}`.slice(0, 255) });
  });
  revalidatePath("/lessons");
  redirect(`/lessons/${lessonId}`);
}

async function saveAsQuizImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { material, session } = await loadMaterial(String(formData.get("materialId") ?? ""));
  const classroomId = String(formData.get("classroomId") ?? "").trim();
  if (material.kind !== "exam" || (material.status !== "ready" && material.status !== "approved")) {
    throw new UserError("Only a finished exam can be saved as a quiz.");
  }
  if (material.assessmentId) return { success: "This exam is already saved as a quiz." };
  if (!material.subjectId) throw new UserError("The textbook isn't linked to a subject. Link it under Resources.");
  const academicYearId = await currentYearId(material.schoolId);
  const [classroom] = await db.select({ id: classrooms.id }).from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.schoolId, material.schoolId), eq(classrooms.academicYearId, academicYearId)))
    .limit(1);
  if (!classroom) return { error: "Choose a class in the current academic year." };

  const exam = material.content as MaterialContent["exam"];
  const questions = exam.multipleChoice.filter((question) =>
    question.options.length >= 2 && question.correctOption >= 0 && question.correctOption < question.options.length);
  if (questions.length === 0) throw new UserError("This exam has no multiple-choice questions to put online.");
  const points = (question: (typeof questions)[number]) => Math.max(1, question.points);
  const written = exam.shortAnswer.length
    ? `\n\nWritten section (mark on paper):\n${exam.shortAnswer.map((question, index) => `${index + 1}. ${question.question} (${question.marks} marks)`).join("\n")}`
    : "";

  const assessmentId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(assessments).values({
      id: assessmentId,
      schoolId: material.schoolId,
      createdBy: session.user.id,
      academicYearId,
      classroomId,
      subjectId: material.subjectId!,
      title: exam.title.slice(0, 200),
      instructions: `${exam.instructions}${written}`.slice(0, 2000),
      maxScore: questions.reduce((total, question) => total + points(question), 0),
    });
    await tx.insert(assessmentQuestions).values(questions.map((question, index) => ({
      assessmentId,
      questionText: question.question,
      options: question.options,
      correctOption: question.correctOption,
      points: points(question),
      sortOrder: index,
    })));
    await tx.update(generatedMaterials).set({ assessmentId }).where(eq(generatedMaterials.id, material.id));
    await tx.insert(activityEvents).values({ schoolId: material.schoolId, userId: session.user.id, detail: `Created assessment: ${exam.title}`.slice(0, 255) });
  });
  revalidatePath("/assessments");
  revalidatePath(`/studio/${material.id}`);
  return { success: `Saved as a draft quiz with ${questions.length} questions. Publish it under Quizzes & tests.` };
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function startGeneration(...args: Parameters<typeof startGenerationImpl>) {
  return guardAction(() => startGenerationImpl(...args));
}
export async function retryGeneration(...args: Parameters<typeof retryGenerationImpl>) {
  return guardAction(() => retryGenerationImpl(...args));
}
export async function approveMaterial(...args: Parameters<typeof approveMaterialImpl>) {
  return guardAction(() => approveMaterialImpl(...args));
}
export async function deleteMaterial(...args: Parameters<typeof deleteMaterialImpl>) {
  return guardAction(() => deleteMaterialImpl(...args));
}
export async function saveAsLessonPlan(...args: Parameters<typeof saveAsLessonPlanImpl>) {
  return guardAction(() => saveAsLessonPlanImpl(...args));
}
export async function saveAsQuiz(...args: Parameters<typeof saveAsQuizImpl>) {
  return guardAction(() => saveAsQuizImpl(...args));
}
