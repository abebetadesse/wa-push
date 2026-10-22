"use server";

import { revalidatePath } from "next/cache";
import { requireSchoolRole } from "@/lib/permissions";
import {
  generateTextbookAssessment,
  saveAssessmentWithQuestions,
  type GeneratedAssessmentPlan,
} from "@/lib/quiz-generator";

export async function generateAssessmentPlanAction(params: {
  schoolId: string;
  resourceId?: string;
  customText?: string;
  subjectName: string;
  gradeName: string;
  type: "quiz" | "exercise" | "exam";
  maxQuestions?: number;
}): Promise<{ plan?: GeneratedAssessmentPlan; error?: string }> {
  try {
    await requireSchoolRole(params.schoolId, ["school_admin", "teacher"]);

    const plan = await generateTextbookAssessment({
      schoolId: params.schoolId,
      resourceId: params.resourceId,
      customText: params.customText,
      subjectName: params.subjectName,
      gradeName: params.gradeName,
      type: params.type,
      maxQuestions: params.maxQuestions ?? 10,
    });

    return { plan };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate assessment." };
  }
}

export async function saveAssessmentPlanAction(params: {
  schoolId: string;
  academicYearId: string;
  classroomId: string;
  subjectId: string;
  title: string;
  instructions: string;
  status: "draft" | "published";
  questions: {
    questionText: string;
    options: string[];
    correctOption: number;
    points: number;
  }[];
}): Promise<{ assessmentId?: string; error?: string }> {
  try {
    const { session } = await requireSchoolRole(params.schoolId, ["school_admin", "teacher"]);

    const { assessmentId } = await saveAssessmentWithQuestions({
      schoolId: params.schoolId,
      createdBy: session.user.id,
      academicYearId: params.academicYearId,
      classroomId: params.classroomId,
      subjectId: params.subjectId,
      title: params.title,
      instructions: params.instructions,
      status: params.status,
      questions: params.questions,
    });

    revalidatePath("/assessments");
    revalidatePath("/my-learning");
    return { assessmentId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save assessment." };
  }
}
