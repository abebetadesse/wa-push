import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RecordForm, RowButton, type FieldSpec } from "@/components/record-form";
import { SchoolPicker, selectedSchool } from "@/components/school-picker";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { authUsers, prMedia, prPosts, publicProfiles, schools } from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import { enumOptions, humanize } from "@/lib/format";
import { prMediaPath } from "@/lib/pr-media";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { deleteMedia, moveProfile, movePost, reviewMedia, saveProfile, savePost, uploadMedia } from "./actions";
import { POST_TYPES, PROFILE_FIELDS } from "./options";

export const metadata: Metadata = { title: "Public relations | Forma" };

const TABS = ["posts", "profile", "media"] as const;
type SearchParams = Promise<{ schoolId?: string; tab?: string; edit?: string }>;

const badge = (status: string) => `role-badge status-${["published", "approved"].includes(status) ? "active" : ["submitted", "pending"].includes(status) ? "on_leave" : "inactive"}`;

function FeedbackForm({ action, hidden, label }: { action: typeof movePost; hidden: Record<string, string>; label: string }) {
  return (
    <ActionForm action={action} className="auth-form feedback-form">
      {Object.entries(hidden).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      <label>{label}<textarea maxLength={5000} name="feedback" required rows={2} /></label>
      <SubmitButton pendingLabel="Sending…">Request changes</SubmitButton>
    </ActionForm>
  );
}

async function PrContent({ searchParams }: { searchParams: SearchParams }) {
  const { schoolIds, schools: visibleSchools, hasRole } = await requireSchoolsFor(pageRoles.pr);
  const params = await searchParams;
  const schoolId = selectedSchool(params.schoolId, schoolIds);
  const tab = activeTab(params.tab, TABS);
  const isAdmin = hasRole(schoolId, "school_admin");

  const [posts, media, [profile], [school]] = await Promise.all([
    db.select({ post: prPosts, author: authUsers.name }).from(prPosts).leftJoin(authUsers, eq(authUsers.id, prPosts.authorId))
      .where(eq(prPosts.schoolId, schoolId)).orderBy(desc(prPosts.updatedAt)).limit(200),
    db.select().from(prMedia).where(eq(prMedia.schoolId, schoolId)).orderBy(desc(prMedia.createdAt)),
    db.select().from(publicProfiles).where(eq(publicProfiles.schoolId, schoolId)).limit(1),
    db.select({ slug: schools.slug, name: schools.name }).from(schools).where(eq(schools.id, schoolId)).limit(1),
  ]);
  const approvedMedia = media.filter((item) => item.status === "approved");
  const mediaOptions = approvedMedia.map((item) => ({ value: item.id, label: item.caption || item.fileName }));
  const editing = posts.find(({ post }) => post.id === params.edit && (post.status === "draft" || post.status === "changes_requested"))?.post;
  const awaiting = posts.filter(({ post }) => post.status === "submitted").length + media.filter((item) => item.status === "pending").length + (profile?.status === "submitted" ? 1 : 0);
  const hidden = { schoolId };

  const postFields: FieldSpec[] = [
    { name: "postType", label: "Type", type: "select", required: true, options: enumOptions(POST_TYPES), defaultValue: editing?.postType ?? "news" },
    { name: "coverMediaId", label: "Cover photo", type: "select", options: mediaOptions, defaultValue: editing?.coverMediaId ?? undefined },
    { name: "title", label: "Title", required: true, max: 200, wide: true, defaultValue: editing?.title },
    { name: "summary", label: "Summary (one or two sentences)", required: true, max: 300, wide: true, defaultValue: editing?.summary },
    { name: "body", label: "Text", type: "textarea", required: true, max: 20000, defaultValue: editing?.body },
  ];
  const profileFields: FieldSpec[] = [
    ...PROFILE_FIELDS.map((field) => ({ name: field.name, label: field.label, type: field.type, max: field.max, defaultValue: profile?.[field.name] ?? undefined })),
    { name: "email", label: "Public email", type: "email", max: 254, defaultValue: profile?.email ?? undefined },
    { name: "heroMediaId", label: "Main photo", type: "select", options: mediaOptions, defaultValue: profile?.heroMediaId ?? undefined },
  ];

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">ENGAGEMENT</p>
          <h1>Public relations</h1>
          <p className="management-description">
            News, announcements, photos and the school&apos;s public profile. The public relations officer prepares them; a school administrator reviews each one and only approved content appears on the public page.
          </p>
        </div>
      </header>
      <SchoolPicker basePath="/pr" keep={{ tab }} schools={visibleSchools} selected={schoolId} />
      <div className="textbook-summary">
        <div><strong>{posts.filter(({ post }) => post.status === "published").length}</strong><span>published posts</span></div>
        <div><strong>{approvedMedia.length}</strong><span>approved photos</span></div>
        <div><strong>{awaiting}</strong><span>waiting for {isAdmin ? "your" : "admin"} review</span></div>
        <div><strong>{profile?.isPublished ? "Online" : "Offline"}</strong><span>public page /{school?.slug}</span></div>
      </div>
      <PageTabs active={tab} basePath="/pr" params={{ schoolId }} tabs={[
        { id: "posts", label: "Posts", count: posts.filter(({ post }) => post.status === "submitted").length || undefined },
        { id: "profile", label: "Public profile" },
        { id: "media", label: "Photos", count: media.filter((item) => item.status === "pending").length || undefined },
      ]} />
      <div className="management-sections">
        {tab === "posts" && <>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>{editing ? "Edit post" : "Write a post"}</h2>{editing && <p><Link className="text-link" href={`/pr?schoolId=${schoolId}`}>Cancel editing</Link></p>}</div></div>
            {editing?.adminFeedback && editing.status === "changes_requested" && <p className="auth-error">Feedback: {editing.adminFeedback}</p>}
            <RecordForm action={savePost} fields={postFields} hidden={editing ? { ...hidden, postId: editing.id } : hidden} key={editing?.id ?? "new"} resetOnSuccess={!editing} submitLabel={editing ? "Save changes" : "Save draft"} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Posts</h2><p>{posts.length} in total</p></div></div>
            {posts.length === 0 ? <p className="empty-state">No posts yet.</p> : <div className="record-list">{posts.map(({ post, author }) => {
              const editable = post.status === "draft" || post.status === "changes_requested";
              return (
                <div className="record-row community-event" key={post.id}>
                  <div><strong>{post.title}</strong>
                    <small>{humanize(post.postType)} · by {author ?? "a former member"} · {post.publishedAt ? `published ${post.publishedAt.toISOString().slice(0, 10)}` : `updated ${post.updatedAt.toISOString().slice(0, 10)}`}</small>
                    <small>{post.summary}</small>
                    {post.adminFeedback && post.status === "changes_requested" && <small className="textbook-warning">Admin feedback: {post.adminFeedback}</small>}
                  </div>
                  <span className={badge(post.status)}>{humanize(post.status)}</span>
                  <span className="inline-actions">
                    {editable && <Link className="secondary-button record-action" href={`/pr?schoolId=${schoolId}&edit=${post.id}`}>Edit</Link>}
                    {editable && !isAdmin && <RowButton action={movePost} hidden={{ ...hidden, postId: post.id, step: "submit" }} label="Submit for review" />}
                    {isAdmin && (editable || post.status === "submitted") && <RowButton action={movePost} hidden={{ ...hidden, postId: post.id, step: "publish" }} label="Publish" />}
                    {isAdmin && post.status === "published" && <RowButton action={movePost} hidden={{ ...hidden, postId: post.id, step: "unpublish" }} label="Unpublish" />}
                    {isAdmin && post.status !== "archived" && <RowButton action={movePost} confirm="Archive this post?" hidden={{ ...hidden, postId: post.id, step: "archive" }} label="Archive" />}
                  </span>
                  {isAdmin && post.status === "submitted" && <FeedbackForm action={movePost} hidden={{ ...hidden, postId: post.id, step: "request_changes" }} label="What should change?" />}
                </div>
              );
            })}</div>}
          </section>
        </>}

        {tab === "profile" && <>
          <section className="management-card">
            <div className="management-card-heading">
              <div>
                <h2>Public profile <span className={badge(profile?.status ?? "draft")}>{humanize(profile?.status ?? "not started")}</span></h2>
                <p>{profile?.publishedContent
                  ? `The public page shows the version approved ${profile.reviewedAt?.toISOString().slice(0, 10) ?? ""}. It is ${profile.isPublished ? "online" : "offline"}.`
                  : "Nothing is approved yet, so there is no public page."}</p>
              </div>
              <span className="inline-actions">
                {profile && (profile.status === "draft" || profile.status === "changes_requested") && !isAdmin && <RowButton action={moveProfile} hidden={{ ...hidden, step: "submit" }} label="Submit for review" />}
                {profile && isAdmin && profile.status !== "approved" && <RowButton action={moveProfile} hidden={{ ...hidden, step: "approve" }} label="Approve" />}
                {profile?.publishedContent && isAdmin && <RowButton action={moveProfile} hidden={{ ...hidden, step: profile.isPublished ? "unpublish" : "publish" }} label={profile.isPublished ? "Take page offline" : "Put page online"} />}
              </span>
            </div>
            {profile?.adminFeedback && profile.status === "changes_requested" && <p className="auth-error">Admin feedback: {profile.adminFeedback}</p>}
            {isAdmin && profile?.status === "submitted" && <FeedbackForm action={moveProfile} hidden={{ ...hidden, step: "request_changes" }} label="What should change before approval?" />}
            <RecordForm action={saveProfile} fields={profileFields} hidden={hidden} resetOnSuccess={false} submitLabel="Save profile" />
          </section>
        </>}

        {tab === "media" && <>
          <section className="management-card">
            <h2>Upload a photo</h2>
            <RecordForm action={uploadMedia} hidden={hidden} pendingLabel="Uploading…" submitLabel="Upload" fields={[
              { name: "file", label: "Photo (JPEG, PNG or WebP, up to 8 MB)", type: "file", required: true, accept: "image/jpeg,image/png,image/webp", wide: true },
              { name: "caption", label: "Caption", max: 300, wide: true },
            ]} />
            <p className="report-note">Only use photos the school may publish. Get consent before showing students&apos; faces.</p>
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Photos</h2><p>{media.length} uploaded · {approvedMedia.length} approved</p></div></div>
            {media.length === 0 ? <p className="empty-state">No photos yet.</p> : <div className="media-grid">{media.map((item) => (
              <figure className="media-card" key={item.id}>
                <Image alt={item.caption ?? item.fileName} height={160} src={withBasePath(prMediaPath(item.id))} unoptimized width={240} />
                <figcaption>
                  <span className={badge(item.status)}>{item.status}</span>
                  <small>{item.caption ?? item.fileName}</small>
                  {item.adminFeedback && <small className="textbook-warning">{item.adminFeedback}</small>}
                  <span className="inline-actions">
                    {isAdmin && item.status !== "approved" && <RowButton action={reviewMedia} hidden={{ ...hidden, mediaId: item.id, decision: "approved" }} label="Approve" />}
                    <RowButton action={deleteMedia} confirm="Delete this photo?" danger hidden={{ ...hidden, mediaId: item.id }} label="Delete" />
                  </span>
                  {isAdmin && item.status === "pending" && (
                    <ActionForm action={reviewMedia} className="inline-actions">
                      <input name="schoolId" type="hidden" value={schoolId} />
                      <input name="mediaId" type="hidden" value={item.id} />
                      <input name="decision" type="hidden" value="rejected" />
                      <input aria-label="Reason" maxLength={1000} name="feedback" placeholder="Reason" required />
                      <SubmitButton pendingLabel="Saving…">Reject</SubmitButton>
                    </ActionForm>
                  )}
                </figcaption>
              </figure>
            ))}</div>}
          </section>
        </>}
      </div>
    </main>
  );
}

export default function PrPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading public relations...</p></main>}><PrContent searchParams={searchParams} /></Suspense>;
}
