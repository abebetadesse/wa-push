"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, prMedia, prPosts, publicProfiles } from "@/db/schema";
import { formFields } from "@/lib/form-fields";
import { resourceStorageDirectory } from "@/lib/learning-resources";
import { requireSchoolRole } from "@/lib/permissions";
import { detectImageType, MAX_PR_IMAGE_BYTES } from "@/lib/pr-media";
import { POST_TYPES, PROFILE_FIELDS } from "./options";

const PR_ROLES = ["school_admin", "pr_officer"] as const;

async function access(formData: FormData) {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session, role } = await requireSchoolRole(schoolId, PR_ROLES);
  return { f, schoolId, userId: session.user.id, isAdmin: role === "school_admin" || role === "platform_admin" };
}

function requireAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new UserError("Only a school administrator can review public content.");
}

async function log(schoolId: string, userId: string, detail: string) {
  await db.insert(activityEvents).values({ schoolId, userId, detail: detail.slice(0, 255) });
}

async function ownMedia(schoolId: string, mediaId: string | null) {
  if (!mediaId) return null;
  const [media] = await db.select({ id: prMedia.id }).from(prMedia)
    .where(and(eq(prMedia.id, mediaId), eq(prMedia.schoolId, schoolId))).limit(1);
  if (!media) throw new UserError("That photo isn't in this school's media library.");
  return media.id;
}

// ---- Photos

async function uploadMediaImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId, isAdmin } = await access(formData);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Choose a photo to upload.");
  if (file.size > MAX_PR_IMAGE_BYTES) throw new UserError("Photos can be at most 8 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) throw new UserError("Upload a JPEG, PNG or WebP photo.");
  const caption = f.optional("caption", "the caption", 300);

  const storageKey = randomUUID();
  const directory = resourceStorageDirectory(schoolId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filePath = join(directory, storageKey);
  await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
  try {
    await db.insert(prMedia).values({
      schoolId,
      storageKey,
      fileName: `${file.name.replace(/[^\w.\- ]+/g, "").slice(0, 200) || "photo"}`.replace(/\.[^.]*$/, "") + type.extension,
      contentType: type.contentType,
      sizeBytes: bytes.byteLength,
      caption,
      // A school admin's own upload needs no second review.
      status: isAdmin ? "approved" : "pending",
      uploadedBy: userId,
      reviewedBy: isAdmin ? userId : null,
      reviewedAt: isAdmin ? new Date() : null,
    });
  } catch (error) {
    await unlink(filePath).catch(() => {});
    throw error;
  }
  revalidatePath("/pr");
  return { success: isAdmin ? "Photo added." : "Photo uploaded. A school administrator will review it." };
}

async function reviewMediaImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId, isAdmin } = await access(formData);
  requireAdmin(isAdmin);
  const decision = f.choice("decision", "a decision", ["approved", "rejected"] as const);
  const feedback = f.optional("feedback", "the feedback", 1000);
  if (decision === "rejected" && !feedback) throw new UserError("Say why the photo can't be used, so the officer can replace it.");
  await db.update(prMedia).set({ status: decision, adminFeedback: feedback, reviewedBy: userId, reviewedAt: new Date() })
    .where(and(eq(prMedia.id, f.id("mediaId", "a photo")), eq(prMedia.schoolId, schoolId)));
  revalidatePath("/pr");
  return {};
}

async function deleteMediaImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId, isAdmin } = await access(formData);
  const [media] = await db.select({ id: prMedia.id, storageKey: prMedia.storageKey, uploadedBy: prMedia.uploadedBy }).from(prMedia)
    .where(and(eq(prMedia.id, f.id("mediaId", "a photo")), eq(prMedia.schoolId, schoolId))).limit(1);
  if (!media) throw new UserError("Photo not found.");
  if (!isAdmin && media.uploadedBy !== userId) throw new UserError("Only the uploader or a school administrator can delete this photo.");
  await db.delete(prMedia).where(eq(prMedia.id, media.id));
  await unlink(join(resourceStorageDirectory(schoolId), media.storageKey)).catch(() => {});
  revalidatePath("/pr");
  return {};
}

// ---- Posts

async function savePostImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId } = await access(formData);
  const postId = f.optionalId("postId", "a post");
  const fields = {
    postType: f.choice("postType", "a post type", POST_TYPES),
    title: f.text("title", "the title", 200),
    summary: f.text("summary", "the summary", 300),
    body: f.text("body", "the text", 20_000),
    coverMediaId: await ownMedia(schoolId, f.optionalId("coverMediaId", "a cover photo")),
  };
  if (postId) {
    const [post] = await db.select({ status: prPosts.status }).from(prPosts)
      .where(and(eq(prPosts.id, postId), eq(prPosts.schoolId, schoolId))).limit(1);
    if (!post) throw new UserError("Post not found.");
    if (post.status !== "draft" && post.status !== "changes_requested") {
      throw new UserError(post.status === "published" ? "Unpublish the post before editing it." : "This post is waiting for review and can't be edited now.");
    }
    await db.update(prPosts).set(fields).where(eq(prPosts.id, postId));
  } else {
    await db.insert(prPosts).values({ schoolId, authorId: userId, ...fields });
    await log(schoolId, userId, `Drafted post: ${fields.title}`);
  }
  revalidatePath("/pr");
  return { success: postId ? "Changes saved." : "Draft saved. Submit it for review when it's ready." };
}

async function movePostImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId, isAdmin } = await access(formData);
  const postId = f.id("postId", "a post");
  const step = f.choice("step", "an action", ["submit", "publish", "request_changes", "unpublish", "archive"] as const);
  const [post] = await db.select({ status: prPosts.status, title: prPosts.title }).from(prPosts)
    .where(and(eq(prPosts.id, postId), eq(prPosts.schoolId, schoolId))).limit(1);
  if (!post) throw new UserError("Post not found.");

  const now = new Date();
  if (step === "submit") {
    if (post.status !== "draft" && post.status !== "changes_requested") throw new UserError("Only drafts can be submitted.");
    await db.update(prPosts).set({ status: "submitted" }).where(eq(prPosts.id, postId));
    await log(schoolId, userId, `Submitted post for review: ${post.title}`);
  } else {
    requireAdmin(isAdmin);
    if (step === "publish") {
      if (post.status === "published" || post.status === "archived") throw new UserError(`This post is already ${post.status}.`);
      await db.update(prPosts).set({ status: "published", publishedAt: now, reviewedBy: userId, reviewedAt: now }).where(eq(prPosts.id, postId));
      await log(schoolId, userId, `Published post: ${post.title}`);
    } else if (step === "request_changes") {
      if (post.status !== "submitted") throw new UserError("Only submitted posts can be sent back.");
      const feedback = f.text("feedback", "your feedback", 5000);
      await db.update(prPosts).set({ status: "changes_requested", adminFeedback: feedback, reviewedBy: userId, reviewedAt: now }).where(eq(prPosts.id, postId));
      await log(schoolId, userId, `Asked for changes to post: ${post.title}`);
    } else if (step === "unpublish") {
      if (post.status !== "published") throw new UserError("Only published posts can be unpublished.");
      await db.update(prPosts).set({ status: "draft", publishedAt: null }).where(eq(prPosts.id, postId));
    } else {
      await db.update(prPosts).set({ status: "archived" }).where(eq(prPosts.id, postId));
    }
  }
  revalidatePath("/pr");
  return {};
}

// ---- Public profile

async function saveProfileImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId, isAdmin } = await access(formData);
  const values = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.name, f.optional(field.name, field.label.toLowerCase(), field.max)])) as Record<(typeof PROFILE_FIELDS)[number]["name"], string | null>;
  const email = f.email("email", "email address");
  const heroMediaId = await ownMedia(schoolId, f.optionalId("heroMediaId", "a main photo"));
  const fields = { ...values, email, heroMediaId };
  // Saving returns the working copy to draft; the public page keeps showing the approved copy.
  await db.insert(publicProfiles).values({ schoolId, ...fields, status: "draft" })
    .onDuplicateKeyUpdate({ set: { ...fields, status: "draft" } });
  await log(schoolId, userId, "Edited the public profile");
  revalidatePath("/pr");
  return { success: isAdmin ? "Saved. Approve it to update the public page." : "Saved. Submit it for review to update the public page." };
}

async function moveProfileImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId, isAdmin } = await access(formData);
  const step = f.choice("step", "an action", ["submit", "approve", "request_changes", "publish", "unpublish"] as const);
  const [profile] = await db.select().from(publicProfiles).where(eq(publicProfiles.schoolId, schoolId)).limit(1);
  if (!profile) throw new UserError("Write the profile first.");
  const now = new Date();

  if (step === "submit") {
    if (profile.status !== "draft" && profile.status !== "changes_requested") throw new UserError("Only a draft can be submitted.");
    await db.update(publicProfiles).set({ status: "submitted" }).where(eq(publicProfiles.schoolId, schoolId));
    await log(schoolId, userId, "Submitted the public profile for review");
  } else {
    requireAdmin(isAdmin);
    if (step === "approve") {
      if (profile.status === "approved") throw new UserError("This version is already approved.");
      const snapshot = Object.fromEntries([...PROFILE_FIELDS.map((field) => field.name), "email", "heroMediaId"].map((name) => [name, profile[name as keyof typeof profile] as string | null]));
      await db.update(publicProfiles).set({ status: "approved", publishedContent: snapshot, adminFeedback: null, reviewedBy: userId, reviewedAt: now })
        .where(eq(publicProfiles.schoolId, schoolId));
      await log(schoolId, userId, "Approved the public profile");
    } else if (step === "request_changes") {
      if (profile.status !== "submitted") throw new UserError("Only a submitted profile can be sent back.");
      const feedback = f.text("feedback", "your feedback", 5000);
      await db.update(publicProfiles).set({ status: "changes_requested", adminFeedback: feedback, reviewedBy: userId, reviewedAt: now })
        .where(eq(publicProfiles.schoolId, schoolId));
      await log(schoolId, userId, "Asked for changes to the public profile");
    } else {
      if (step === "publish" && !profile.publishedContent) throw new UserError("Approve the profile before putting the page online.");
      await db.update(publicProfiles).set({ isPublished: step === "publish" }).where(eq(publicProfiles.schoolId, schoolId));
      await log(schoolId, userId, step === "publish" ? "Put the public page online" : "Took the public page offline");
    }
  }
  revalidatePath("/pr");
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function uploadMedia(...args: Parameters<typeof uploadMediaImpl>) {
  return guardAction(() => uploadMediaImpl(...args));
}
export async function reviewMedia(...args: Parameters<typeof reviewMediaImpl>) {
  return guardAction(() => reviewMediaImpl(...args));
}
export async function deleteMedia(...args: Parameters<typeof deleteMediaImpl>) {
  return guardAction(() => deleteMediaImpl(...args));
}
export async function savePost(...args: Parameters<typeof savePostImpl>) {
  return guardAction(() => savePostImpl(...args));
}
export async function movePost(...args: Parameters<typeof movePostImpl>) {
  return guardAction(() => movePostImpl(...args));
}
export async function saveProfile(...args: Parameters<typeof saveProfileImpl>) {
  return guardAction(() => saveProfileImpl(...args));
}
export async function moveProfile(...args: Parameters<typeof moveProfileImpl>) {
  return guardAction(() => moveProfileImpl(...args));
}
