"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  academicYears,
  activityEvents,
  assessmentAttempts,
  assessmentQuestions,
  assessmentResults,
  assessmentReminders,
  assessments,
  classrooms,
  enrollments,
  students,
  schools,
  subjects,
} from "@/db/schema";
import { isPlatformAdmin, requireSchoolRole, requireSession } from "@/lib/permissions";
import { isDuplicateEntry } from "@/lib/db-errors";
import { sendEmail } from "@/lib/email";
import {
  parseQuestionImport,
  QuestionImportError,
  type QuestionImportFormat,
} from "@/lib/moodle-questions";
import { todayInTimeZone } from "@/lib/date";

export type AssessmentActionState = { error?: string; success?: string };

type QuestionInput = {
  prompt: string;
  options: string[];
  correctOption: number;
  points: number;
};

const importFormats = new Set<QuestionImportFormat>([
  "moodle-xml",
  "gift",
  "aiken",
  "blackboard",
  "webct",
]);
const MAX_QUESTION_IMPORT_BYTES = 10 * 1024 * 1024;

async function parseQuestions(
  formData: FormData,
): Promise<{ questions: QuestionInput[]; skipped: number } | { error: string }> {
  const uploadedFile = formData.get("questionFile");
  if (uploadedFile instanceof File && uploadedFile.name) {
    if (uploadedFile.size === 0) return { error: "The selected question file is empty." };
    if (uploadedFile.size > MAX_QUESTION_IMPORT_BYTES) {
      return { error: "Question import files must be 10 MB or smaller." };
    }
    const format = String(formData.get("questionFormat") ?? "");
    if (!importFormats.has(format as QuestionImportFormat)) {
      return { error: "Choose a supported question import format." };
    }
    let source: string;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(await uploadedFile.arrayBuffer());
    } catch {
      return { error: "Question import files must use UTF-8 text encoding." };
    }
    try {
      const result = parseQuestionImport(source, format as QuestionImportFormat);
      return { questions: result.questions, skipped: result.skipped };
    } catch (error) {
      if (error instanceof QuestionImportError) return { error: error.message };
      throw error;
    }
  }

  const promptEntries = formData.getAll("question");
  const choices = ["optionA", "optionB", "optionC", "optionD"].map((name) =>
    formData.getAll(name),
  );
  const correctEntries = formData.getAll("correctOption");
  const pointEntries = formData.getAll("points");
  const entries = [...promptEntries, ...choices.flat(), ...correctEntries, ...pointEntries];
  if (
    promptEntries.length < 1 ||
    promptEntries.length > 30 ||
    choices.some((values) => values.length !== promptEntries.length) ||
    correctEntries.length !== promptEntries.length ||
    pointEntries.length !== promptEntries.length ||
    entries.some((value) => typeof value !== "string")
  ) return { error: "Add 1–30 valid questions before saving this assessment." };

  const questions: QuestionInput[] = [];
  for (let index = 0; index < promptEntries.length; index += 1) {
    const prompt = String(promptEntries[index]).trim();
    const options = choices.map((values) => String(values[index] ?? "").trim());
    const correctOption = Number(correctEntries[index]);
    const points = Number(pointEntries[index]);
    if (
      !prompt ||
      prompt.length > 2000 ||
      options.slice(0, 2).some((option) => !option) ||
      options.some((option) => option.length > 500) ||
      !Number.isInteger(correctOption) ||
      correctOption < 0 ||
      correctOption > 3 ||
      !options[correctOption] ||
      !Number.isInteger(points) ||
      points < 1 ||
      points > 100
    ) return { error: "Each question needs a prompt, at least two options, a correct answer, and a score from 1 to 100." };

    questions.push({ prompt, options, correctOption, points });
  }
  return { questions, skipped: 0 };
}

async function createAssessmentImpl(
  _previous: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const academicYearId = String(formData.get("academicYearId") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const dueOn = String(formData.get("dueOn") ?? "").trim();

  if (!schoolId || !academicYearId || !classroomId || !subjectId) {
    return { error: "Select a school, academic year, class, and subject." };
  }
  if (!title || title.length > 200 || instructions.length > 2000) {
    return { error: "Add a title of at most 200 characters and keep instructions under 2,000 characters." };
  }
  if (dueOn && !isValidDate(dueOn)) return { error: "Choose a valid assessment due date." };

  const { session } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);
  const parsedQuestions = await parseQuestions(formData);
  if ("error" in parsedQuestions) return { error: parsedQuestions.error };
  const questions = parsedQuestions.questions;
  const maxScore = questions.reduce((total, question) => total + question.points, 0);
  const [classroom] = await db
    .select({ id: classrooms.id })
    .from(classrooms)
    .innerJoin(academicYears, and(
      eq(classrooms.academicYearId, academicYears.id),
      eq(academicYears.schoolId, schoolId),
    ))
    .where(and(
      eq(classrooms.id, classroomId),
      eq(classrooms.schoolId, schoolId),
      eq(classrooms.academicYearId, academicYearId),
    ))
    .limit(1);
  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)))
    .limit(1);
  if (!classroom || !subject) return { error: "The selected class, year, or subject does not belong to this school." };

  const assessmentId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(assessments).values({
      id: assessmentId,
      schoolId,
      createdBy: session.user.id,
      academicYearId,
      classroomId,
      subjectId,
      title,
      instructions: instructions || null,
      dueOn: dueOn || null,
      maxScore,
    });
    await tx.insert(assessmentQuestions).values(questions.map((question, index) => ({
      id: randomUUID(),
      assessmentId,
      questionText: question.prompt,
      options: question.options,
      correctOption: question.correctOption,
      points: question.points,
      sortOrder: index,
    })));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Created assessment: ${title}`,
    });
  });

  revalidatePath("/");
  revalidatePath("/assessments");
  const skippedMessage = parsedQuestions.skipped
    ? ` ${parsedQuestions.skipped} unsupported or invalid question${parsedQuestions.skipped === 1 ? " was" : "s were"} skipped.`
    : "";
  return {
    success: `Assessment “${title}” saved as a draft with ${questions.length} question${questions.length === 1 ? "" : "s"} and ${maxScore} possible points.${skippedMessage}`,
  };
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function changeAssessmentStatusImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim();
  if (!schoolId || !assessmentId || !["published", "closed"].includes(nextStatus)) {
    throw new UserError("Invalid assessment status request.");
  }

  const { session, role } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);
  if (role !== "school_admin" && !isPlatformAdmin(session)) {
    throw new UserError("Only a school administrator can publish or close an assessment.");
  }

  const [assessment] = await db
    .select({ title: assessments.title, status: assessments.status })
    .from(assessments)
    .where(and(eq(assessments.id, assessmentId), eq(assessments.schoolId, schoolId)))
    .limit(1);
  if (!assessment) throw new UserError("Assessment not found in this school.");
  const validTransition =
    (assessment.status === "draft" && nextStatus === "published") ||
    (assessment.status === "published" && nextStatus === "closed");
  if (!validTransition) throw new UserError("This assessment cannot be moved to that status.");

  await db.transaction(async (tx) => {
    await tx.update(assessments)
      .set({ status: nextStatus })
      .where(and(eq(assessments.id, assessmentId), eq(assessments.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `${nextStatus === "published" ? "Published" : "Closed"} assessment: ${assessment.title}`,
    });
  });
  revalidatePath("/");
  revalidatePath("/assessments");
  return {};
}

async function recordAssessmentResultImpl(
  _previous: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();
  const rawScore = String(formData.get("score") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim();
  const score = Number(rawScore);

  if (!schoolId || !assessmentId || !studentId || !rawScore || !Number.isInteger(score)) {
    return { error: "Select a student and enter a whole-number score." };
  }
  if (feedback.length > 500) return { error: "Feedback must be 500 characters or fewer." };

  const { session } = await requireSchoolRole(schoolId, ["school_admin", "teacher"]);
  const [assessment] = await db.select({
    id: assessments.id,
    title: assessments.title,
    classroomId: assessments.classroomId,
    maxScore: assessments.maxScore,
    status: assessments.status,
  })
    .from(assessments)
    .where(and(eq(assessments.id, assessmentId), eq(assessments.schoolId, schoolId)))
    .limit(1);
  if (!assessment || assessment.status !== "published") {
    return { error: "Results can only be recorded for a published assessment in this school." };
  }
  if (score < 0 || score > assessment.maxScore) {
    return { error: `Score must be between 0 and ${assessment.maxScore}.` };
  }

  const [eligibleStudent] = await db
    .select({ id: students.id })
    .from(enrollments)
    .innerJoin(students, and(
      eq(enrollments.studentId, students.id),
      eq(students.schoolId, schoolId),
    ))
    .where(and(
      eq(enrollments.schoolId, schoolId),
      eq(enrollments.classroomId, assessment.classroomId),
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, "enrolled"),
      eq(students.status, "active"),
    ))
    .limit(1);
  if (!eligibleStudent) return { error: "The selected student is not actively enrolled in this assessment’s class." };

  await db.transaction(async (tx) => {
    await tx.insert(assessmentResults).values({
      id: randomUUID(),
      schoolId,
      assessmentId,
      studentId,
      score,
      feedback: feedback || null,
      markedBy: session.user.id,
    }).onDuplicateKeyUpdate({
      set: { score, feedback: feedback || null, markedBy: session.user.id, updatedAt: new Date() },
    });
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `Recorded a result for ${assessment.title}`,
    });
  });

  revalidatePath("/");
  revalidatePath("/assessments");
  return { success: "Assessment result saved." };
}

async function submitAssessmentAttemptImpl(
  _previous: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const answerEntries = formData.getAll("answer");
  if (
    !assessmentId ||
    answerEntries.some((answer) => typeof answer !== "string") ||
    answerEntries.some((answer) => !/^(0|[1-9]\d*)$/.test(String(answer)))
  ) {
    return { error: "This assessment submission is invalid." };
  }
  const answers = answerEntries.map((answer) => Number(answer));
  if (answers.some((answer) => !Number.isSafeInteger(answer))) {
    return { error: "This assessment submission is invalid." };
  }
  const session = await requireSession();
  const [assessment] = await db
    .select({
      id: assessments.id,
      schoolId: assessments.schoolId,
      classroomId: assessments.classroomId,
      academicYearId: assessments.academicYearId,
      title: assessments.title,
      status: assessments.status,
      dueOn: assessments.dueOn,
      timeZone: schools.timezone,
    })
    .from(assessments)
    .innerJoin(schools, eq(schools.id, assessments.schoolId))
    .where(eq(assessments.id, assessmentId))
    .limit(1);
  if (!assessment || assessment.status !== "published") {
    return { error: "This assessment is not available." };
  }
  if (assessment.dueOn && todayInTimeZone(assessment.timeZone) > assessment.dueOn) {
    return { error: "The deadline for this assessment has passed." };
  }

  const { session: studentSession } = await requireSchoolRole(assessment.schoolId, ["student"]);
  if (studentSession.user.id !== session.user.id) {
    return { error: "You do not have access to this assessment." };
  }
  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(
      eq(students.schoolId, assessment.schoolId),
      eq(students.userId, session.user.id),
      eq(students.status, "active"),
    ))
    .limit(1);
  if (!student) return { error: "Your active student record is not available." };

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(
      eq(enrollments.schoolId, assessment.schoolId),
      eq(enrollments.studentId, student.id),
      eq(enrollments.classroomId, assessment.classroomId),
      eq(enrollments.academicYearId, assessment.academicYearId),
      eq(enrollments.status, "enrolled"),
    ))
    .limit(1);
  if (!enrollment) return { error: "You are no longer enrolled in this assessment's class." };

  try {
    const score = await db.transaction(async (tx) => {
      const [lockedAssessment] = await tx
        .select({ id: assessments.id, status: assessments.status, dueOn: assessments.dueOn })
        .from(assessments)
        .where(and(
          eq(assessments.id, assessment.id),
          eq(assessments.schoolId, assessment.schoolId),
        ))
        .for("update")
        .limit(1);
      if (!lockedAssessment || lockedAssessment.status !== "published") {
        throw new UserError("This assessment is no longer open.");
      }
      if (lockedAssessment.dueOn && todayInTimeZone(assessment.timeZone) > lockedAssessment.dueOn) {
        throw new UserError("The deadline for this assessment has passed.");
      }

      const questions = await tx
        .select({
          correctOption: assessmentQuestions.correctOption,
          points: assessmentQuestions.points,
          options: assessmentQuestions.options,
        })
        .from(assessmentQuestions)
        .where(eq(assessmentQuestions.assessmentId, assessment.id))
        .orderBy(assessmentQuestions.sortOrder);
      if (questions.length === 0 || questions.length !== answers.length) {
        throw new UserError("Answer every question before submitting.");
      }
      if (answers.some((answer, index) => !questions[index]?.options[answer]?.trim())) {
        throw new UserError("One or more selected answers are invalid.");
      }

      const earned = questions.reduce(
        (total, question, index) => total + (answers[index] === question.correctOption ? question.points : 0),
        0,
      );
      const maximum = questions.reduce((total, question) => total + question.points, 0);
      await tx.insert(assessmentAttempts).values({
        id: randomUUID(),
        schoolId: assessment.schoolId,
        assessmentId: assessment.id,
        studentId: student.id,
        answers,
        score: earned,
        maxScore: maximum,
      });
      await tx.insert(activityEvents).values({
        schoolId: assessment.schoolId,
        userId: session.user.id,
        detail: `Submitted assessment: ${assessment.title}`,
      });
      return { earned, maximum };
    });

    revalidatePath("/my-learning");
    revalidatePath("/assessments");
    return { success: `Assessment submitted. Your score is ${score.earned} out of ${score.maximum}.` };
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "You have already submitted this assessment." };
    if (error instanceof Error && [
      "This assessment is no longer open.",
      "The deadline for this assessment has passed.",
      "Answer every question before submitting.",
      "One or more selected answers are invalid.",
    ].includes(error.message)) {
      return { error: error.message };
    }
    throw error;
  }
}

async function sendAssessmentRemindersImpl(
      _previous: AssessmentActionState,
      formData: FormData,
    ): Promise<AssessmentActionState> {
      const schoolId = String(formData.get("schoolId") ?? "").trim();
      const assessmentId = String(formData.get("assessmentId") ?? "").trim();
      if (!schoolId || !assessmentId) return { error: "Select an assessment." };
      await requireSchoolRole(schoolId, ["school_admin", "teacher"]);

      const [assessment] = await db.select({
        title: assessments.title,
        status: assessments.status,
        dueOn: assessments.dueOn,
        classroomId: assessments.classroomId,
        academicYearId: assessments.academicYearId,
      }).from(assessments)
        .where(and(eq(assessments.id, assessmentId), eq(assessments.schoolId, schoolId)))
        .limit(1);
      if (!assessment || assessment.status !== "published") {
        return { error: "Reminders can only be sent for published assessments." };
      }

      const [classRoster, attempts, reminders] = await Promise.all([
        db.select({
          id: students.id,
          name: students.firstName,
          lastName: students.lastName,
          email: students.email,
        }).from(enrollments)
          .innerJoin(students, and(
            eq(students.id, enrollments.studentId),
            eq(students.schoolId, enrollments.schoolId),
          ))
          .where(and(
            eq(enrollments.schoolId, schoolId),
            eq(enrollments.classroomId, assessment.classroomId),
            eq(enrollments.academicYearId, assessment.academicYearId),
            eq(enrollments.status, "enrolled"),
            eq(students.status, "active"),
          )),
        db.select({ studentId: assessmentAttempts.studentId }).from(assessmentAttempts)
          .where(and(eq(assessmentAttempts.schoolId, schoolId), eq(assessmentAttempts.assessmentId, assessmentId))),
        db.select({ studentId: assessmentReminders.studentId }).from(assessmentReminders)
          .where(and(eq(assessmentReminders.schoolId, schoolId), eq(assessmentReminders.assessmentId, assessmentId))),
      ]);
      const alreadySubmitted = new Set(attempts.map(({ studentId }) => studentId));
      const alreadyReminded = new Set(reminders.map(({ studentId }) => studentId));
      const recipients = classRoster.flatMap((student) =>
        student.email && !alreadySubmitted.has(student.id) && !alreadyReminded.has(student.id)
          ? [{ ...student, email: student.email }]
          : [],
      );
      if (recipients.length === 0) {
        return { success: "No students with a current email address need a reminder." };
      }

      let sent = 0;
      let failed = 0;
      for (const student of recipients) {
        try {
          await sendEmail({
            to: student.email,
            subject: `Reminder: ${assessment.title}`,
            text: `Hello ${student.name} ${student.lastName},\n\nYou have not submitted "${assessment.title}" yet.${assessment.dueOn ? ` It is due on ${assessment.dueOn}.` : ""} Sign in to Forma and open My learning to complete it.`,
          });
          await db.insert(assessmentReminders).values({
            id: randomUUID(),
            schoolId,
            assessmentId,
            studentId: student.id,
          });
          sent += 1;
        } catch (error) {
          console.error(`Could not send an assessment reminder to ${student.email}.`, error);
          failed += 1;
        }
      }
      revalidatePath("/assessments");
      if (failed) return { error: `Sent ${sent} reminder${sent === 1 ? "" : "s"}; ${failed} failed and can be retried.` };
      return { success: `Sent ${sent} reminder${sent === 1 ? "" : "s"}.` };
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function createAssessment(...args: Parameters<typeof createAssessmentImpl>) {
  return guardAction(() => createAssessmentImpl(...args));
}
export async function recordAssessmentResult(...args: Parameters<typeof recordAssessmentResultImpl>) {
  return guardAction(() => recordAssessmentResultImpl(...args));
}
export async function submitAssessmentAttempt(...args: Parameters<typeof submitAssessmentAttemptImpl>) {
  return guardAction(() => submitAssessmentAttemptImpl(...args));
}
export async function changeAssessmentStatus(...args: Parameters<typeof changeAssessmentStatusImpl>) {
  return guardAction(() => changeAssessmentStatusImpl(...args));
}
export async function sendAssessmentReminders(...args: Parameters<typeof sendAssessmentRemindersImpl>) {
  return guardAction(() => sendAssessmentRemindersImpl(...args));
}
