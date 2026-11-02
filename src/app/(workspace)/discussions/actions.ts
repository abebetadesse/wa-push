"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classrooms, discussionPosts, discussionThreads, enrollments, students, subjects } from "@/db/schema";
import { formFields } from "@/lib/form-fields";
import { requirePrivilege, rolesAllow } from "@/lib/permissions";

/** A student may post only in school-wide threads and their own classes'. */
async function studentMayUseClass(schoolId: string, userId: string, classroomId: string | null) {
  if (!classroomId) return true;
  const [row] = await db.select({ id: enrollments.id }).from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(and(eq(students.userId, userId), eq(students.schoolId, schoolId), eq(enrollments.classroomId, classroomId))).limit(1);
  return Boolean(row);
}

async function startThreadImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const access = await requirePrivilege(schoolId, "discussions", "add");
  const classroomId = f.optionalId("classroomId", "a class");
  const subjectId = f.optionalId("subjectId", "a subject");
  if (classroomId) {
    const [classroom] = await db.select({ id: classrooms.id }).from(classrooms).where(and(eq(classrooms.id, classroomId), eq(classrooms.schoolId, schoolId))).limit(1);
    if (!classroom) throw new UserError("Choose a class of this school.");
  }
  if (subjectId) {
    const [subject] = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId))).limit(1);
    if (!subject) throw new UserError("Choose a subject of this school.");
  }
  if (access.role !== "platform_admin" && access.roles.every((role) => role === "student") && !(await studentMayUseClass(schoolId, access.session.user.id, classroomId))) {
    throw new UserError("You can start discussions for the whole school or your own class.");
  }
  const title = f.text("title", "a title", 200);
  await db.insert(discussionThreads).values({ schoolId, classroomId, subjectId, title, body: f.text("body", "your message", 5000), authorId: access.session.user.id });
  revalidatePath("/discussions");
  return { success: "Your discussion was posted." };
}

async function loadThread(threadId: string) {
  const [thread] = await db.select().from(discussionThreads).where(eq(discussionThreads.id, threadId)).limit(1);
  if (!thread) throw new UserError("That discussion no longer exists.");
  return thread;
}

async function replyImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const thread = await loadThread(f.id("threadId", "a discussion"));
  const access = await requirePrivilege(thread.schoolId, "discussions", "add");
  const moderator = access.role === "platform_admin" || await rolesAllow(thread.schoolId, access.roles, "discussions", "approve");
  if (thread.locked && !moderator) throw new UserError("This discussion is closed for replies.");
  if (thread.hidden && !moderator) throw new UserError("This discussion was hidden by a moderator.");
  if (!moderator && access.roles.every((role) => role === "student") && !(await studentMayUseClass(thread.schoolId, access.session.user.id, thread.classroomId))) {
    throw new UserError("This discussion belongs to another class.");
  }
  await db.transaction(async (tx) => {
    await tx.insert(discussionPosts).values({ threadId: thread.id, authorId: access.session.user.id, body: f.text("body", "your reply", 5000) });
    await tx.update(discussionThreads).set({ lastActivityAt: new Date() }).where(eq(discussionThreads.id, thread.id));
  });
  revalidatePath("/discussions");
  return { success: "Reply posted." };
}

async function moderateImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const f = formFields(formData);
  const thread = await loadThread(f.id("threadId", "a discussion"));
  const step = f.choice("step", "an action", ["pin", "unpin", "lock", "unlock", "hide", "show", "hide_post", "show_post"] as const);
  const postId = f.optionalId("postId", "a reply");
  const access = await requirePrivilege(thread.schoolId, "discussions", "read");
  const moderator = access.role === "platform_admin" || await rolesAllow(thread.schoolId, access.roles, "discussions", "approve");
  if (step === "hide_post" || step === "show_post") {
    if (!postId) throw new UserError("Choose a reply.");
    const [post] = await db.select().from(discussionPosts).where(and(eq(discussionPosts.id, postId), eq(discussionPosts.threadId, thread.id))).limit(1);
    if (!post) throw new UserError("That reply no longer exists.");
    // Authors may take back their own reply; moderators may hide or restore any.
    if (!moderator && !(post.authorId === access.session.user.id && step === "hide_post")) throw new UserError("Only a moderator can do this.");
    await db.update(discussionPosts).set({ hidden: step === "hide_post" }).where(eq(discussionPosts.id, post.id));
  } else {
    const own = thread.authorId === access.session.user.id;
    if (!moderator && !(own && step === "hide")) throw new UserError("Only a moderator can do this.");
    const set = step === "pin" || step === "unpin" ? { pinned: step === "pin" } : step === "lock" || step === "unlock" ? { locked: step === "lock" } : { hidden: step === "hide" };
    await db.update(discussionThreads).set(set).where(eq(discussionThreads.id, thread.id));
  }
  revalidatePath("/discussions");
  return {};
}

export async function startThread(...args: Parameters<typeof startThreadImpl>) { return guardAction(() => startThreadImpl(...args)); }
export async function reply(...args: Parameters<typeof replyImpl>) { return guardAction(() => replyImpl(...args)); }
export async function moderate(...args: Parameters<typeof moderateImpl>) { return guardAction(() => moderateImpl(...args)); }
