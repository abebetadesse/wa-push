import type { Metadata } from "next";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { RecordForm, RowButton } from "@/components/record-form";
import { RelativeTime } from "@/components/relative-time";
import { SchoolPicker, selectedSchool } from "@/components/school-picker";
import { db } from "@/db";
import { academicYears, authUsers, classrooms, discussionPosts, discussionThreads, enrollments, students, subjects } from "@/db/schema";
import { initials } from "@/lib/format";
import { requireSchoolsWithPrivilege } from "@/lib/workspace";
import { moderate, reply, startThread } from "./actions";

export const metadata: Metadata = { title: "Discussions | Forma" };

type SearchParams = Promise<{ schoolId?: string; thread?: string; classroom?: string }>;

async function DiscussionsContent({ searchParams }: { searchParams: SearchParams }) {
  const { context, schools, schoolIds, can, rolesAt } = await requireSchoolsWithPrivilege("discussions");
  const params = await searchParams;
  const schoolId = selectedSchool(params.schoolId, schoolIds);
  const roles = rolesAt(schoolId);
  const moderator = can(schoolId, "discussions", "approve");
  const mayPost = can(schoolId, "discussions", "add");
  const studentOnly = !context.platformAdmin && roles.length > 0 && roles.every((role) => role === "student");

  const allClasses = await db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms)
    .innerJoin(academicYears, and(eq(classrooms.academicYearId, academicYears.id), eq(academicYears.isCurrent, true)))
    .where(eq(classrooms.schoolId, schoolId)).orderBy(asc(classrooms.name));
  // Students see the school-wide channel and their own classes; staff see every class.
  const myClassIds = studentOnly
    ? (await db.select({ classroomId: enrollments.classroomId }).from(enrollments).innerJoin(students, eq(enrollments.studentId, students.id))
      .where(and(eq(students.userId, context.userId), eq(students.schoolId, schoolId)))).map((row) => row.classroomId)
    : allClasses.map((entry) => entry.id);
  const classes = allClasses.filter((entry) => myClassIds.includes(entry.id));
  const channel = classes.find((entry) => entry.id === params.classroom)?.id ?? null;
  const subjectRows = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(asc(subjects.name));

  const threads = await db.select({
    id: discussionThreads.id, title: discussionThreads.title, body: discussionThreads.body, classroomId: discussionThreads.classroomId, subjectId: discussionThreads.subjectId,
    pinned: discussionThreads.pinned, locked: discussionThreads.locked, hidden: discussionThreads.hidden, lastActivityAt: discussionThreads.lastActivityAt,
    createdAt: discussionThreads.createdAt, authorId: discussionThreads.authorId, author: authUsers.name,
  }).from(discussionThreads).innerJoin(authUsers, eq(discussionThreads.authorId, authUsers.id))
    .where(and(
      eq(discussionThreads.schoolId, schoolId),
      channel ? eq(discussionThreads.classroomId, channel) : studentOnly ? or(isNull(discussionThreads.classroomId), myClassIds.length ? inArray(discussionThreads.classroomId, myClassIds) : undefined) : undefined,
      moderator ? undefined : or(eq(discussionThreads.hidden, false), eq(discussionThreads.authorId, context.userId)),
    ))
    .orderBy(desc(discussionThreads.pinned), desc(discussionThreads.lastActivityAt)).limit(100);
  const open = threads.find((thread) => thread.id === params.thread);
  const posts = open ? await db.select({ id: discussionPosts.id, body: discussionPosts.body, hidden: discussionPosts.hidden, createdAt: discussionPosts.createdAt, authorId: discussionPosts.authorId, author: authUsers.name })
    .from(discussionPosts).innerJoin(authUsers, eq(discussionPosts.authorId, authUsers.id))
    .where(eq(discussionPosts.threadId, open.id)).orderBy(asc(discussionPosts.createdAt)) : [];
  const className = new Map(allClasses.map((entry) => [entry.id, entry.name]));
  const subjectName = new Map(subjectRows.map((entry) => [entry.id, entry.name]));
  const link = (threadId?: string) => `/discussions?${new URLSearchParams(Object.entries({ schoolId, classroom: channel ?? "", thread: threadId ?? "" }).filter(([, value]) => value))}`;

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href={studentOnly ? "/my-progress" : "/"} className="management-back">← {studentOnly ? "My progress" : "Dashboard"}</Link>
          <p className="auth-eyebrow">COMMUNITY</p>
          <h1>Discussions</h1>
          <p className="management-description">Ask questions, help each other and talk about lessons — with the whole school or your class. Be kind: teachers can hide posts and close discussions.</p>
        </div>
      </header>
      <SchoolPicker basePath="/discussions" schools={schools} selected={schoolId} />
      <nav aria-label="Channels" className="page-tabs">
        <Link aria-current={!channel ? "page" : undefined} className="page-tab" href={`/discussions?schoolId=${schoolId}`}>{studentOnly ? "School & my classes" : "All"}</Link>
        {classes.map((entry) => <Link aria-current={channel === entry.id ? "page" : undefined} className="page-tab" href={`/discussions?schoolId=${schoolId}&classroom=${entry.id}`} key={entry.id}>{entry.name}</Link>)}
      </nav>

      <div className="discussion-layout">
        <section className="management-card discussion-list">
          <div className="management-card-heading"><div><h2>Discussions</h2><p>{threads.length} shown</p></div></div>
          {threads.length === 0 ? <p className="empty-state">No discussions yet. Start the first one.</p> : <ul>{threads.map((thread) => (
            <li aria-current={thread.id === open?.id ? "true" : undefined} key={thread.id}>
              <Link href={link(thread.id)}>
                <strong>{thread.pinned && "📌 "}{thread.title}</strong>
                <small>{[thread.author, thread.classroomId ? className.get(thread.classroomId) : "Whole school", thread.subjectId && subjectName.get(thread.subjectId), thread.locked && "closed", thread.hidden && "hidden"].filter(Boolean).join(" · ")} · <RelativeTime value={thread.lastActivityAt.toISOString()} /></small>
              </Link>
            </li>
          ))}</ul>}
          {mayPost && (
            <details className="discussion-new" open={threads.length === 0}>
              <summary>Start a discussion</summary>
              <RecordForm action={startThread} hidden={{ schoolId }} submitLabel="Post" fields={[
                { name: "title", label: "Title", required: true, max: 200, wide: true, placeholder: "How do we solve question 4 of the homework?" },
                { name: "classroomId", label: "Where", type: "select", defaultValue: channel ?? "", options: classes.map((entry) => ({ value: entry.id, label: `Class ${entry.name}` })) },
                { name: "subjectId", label: "Subject", type: "select", options: subjectRows.map((entry) => ({ value: entry.id, label: entry.name })) },
                { name: "body", label: "Message", type: "textarea", required: true, max: 5000 },
              ]} />
            </details>
          )}
        </section>

        <section className="management-card discussion-thread">
          {!open ? <p className="empty-state">Choose a discussion to read it.</p> : <>
            <header>
              <h2>{open.title}</h2>
              <small>{open.author} · <RelativeTime value={open.createdAt.toISOString()} /> · {open.classroomId ? className.get(open.classroomId) : "Whole school"}{open.subjectId ? ` · ${subjectName.get(open.subjectId)}` : ""}</small>
              <span className="inline-actions">
                {moderator && <RowButton action={moderate} hidden={{ threadId: open.id, step: open.pinned ? "unpin" : "pin" }} label={open.pinned ? "Unpin" : "Pin"} />}
                {moderator && <RowButton action={moderate} hidden={{ threadId: open.id, step: open.locked ? "unlock" : "lock" }} label={open.locked ? "Reopen" : "Close replies"} />}
                {(moderator || open.authorId === context.userId) && <RowButton action={moderate} danger={!open.hidden} hidden={{ threadId: open.id, step: open.hidden ? "show" : "hide" }} label={open.hidden ? "Show" : "Hide"} />}
              </span>
            </header>
            <article className="discussion-post discussion-opening"><span className="avatar">{initials(open.author)}</span><div><p>{open.body}</p></div></article>
            {posts.map((post) => (post.hidden && !moderator && post.authorId !== context.userId ? null : (
              <article className={`discussion-post${post.hidden ? " field-inactive" : ""}`} key={post.id}>
                <span className="avatar">{initials(post.author)}</span>
                <div>
                  <small><strong>{post.author}</strong> · <RelativeTime value={post.createdAt.toISOString()} />{post.hidden && " · hidden"}</small>
                  <p>{post.body}</p>
                </div>
                {(moderator || (post.authorId === context.userId && !post.hidden)) && <RowButton action={moderate} hidden={{ threadId: open.id, postId: post.id, step: post.hidden ? "show_post" : "hide_post" }} label={post.hidden ? "Show" : post.authorId === context.userId ? "Delete" : "Hide"} />}
              </article>
            )))}
            {mayPost && (!open.locked || moderator)
              ? <RecordForm action={reply} hidden={{ threadId: open.id }} submitLabel="Reply" fields={[{ name: "body", label: "Your reply", type: "textarea", required: true, max: 5000 }]} />
              : open.locked && <p className="field-help">Replies are closed.</p>}
          </>}
        </section>
      </div>
    </main>
  );
}

export default function DiscussionsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading discussions...</p></main>}><DiscussionsContent searchParams={searchParams} /></Suspense>;
}
