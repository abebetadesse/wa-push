import type { Metadata } from "next";
import { and, count, desc, eq, gte } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { communityEvents, prMedia, prPosts, publicProfiles, students, teachers } from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import { loadHierarchy, schoolAncestors } from "@/lib/hierarchy";
import { ORG_LEVEL_LABELS } from "@/lib/roles";
import { humanize } from "@/lib/format";
import { loadPublicSchool } from "@/lib/public-school";

export const metadata: Metadata = { title: "School | Forma" };

type Params = Promise<{ slug: string }>;

async function SchoolProfile({ params }: { params: Params }) {
  const { slug } = await params;
  const school = await loadPublicSchool(slug);
  if (!school) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const [[profile], posts, events, media, hierarchy, [studentCount], [teacherCount]] = await Promise.all([
    db.select().from(publicProfiles).where(eq(publicProfiles.schoolId, school.id)).limit(1),
    db.select().from(prPosts).where(and(eq(prPosts.schoolId, school.id), eq(prPosts.status, "published"))).orderBy(desc(prPosts.publishedAt)).limit(6),
    db.select().from(communityEvents).where(and(eq(communityEvents.schoolId, school.id), eq(communityEvents.isPublic, true), gte(communityEvents.eventDate, today))).orderBy(communityEvents.eventDate).limit(6),
    db.select({ id: prMedia.id, caption: prMedia.caption }).from(prMedia).where(and(eq(prMedia.schoolId, school.id), eq(prMedia.status, "approved"))).orderBy(desc(prMedia.createdAt)).limit(8),
    loadHierarchy(),
    db.select({ value: count() }).from(students).where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select({ value: count() }).from(teachers).where(and(eq(teachers.schoolId, school.id), eq(teachers.status, "active"))),
  ]);
  const content = profile?.isPublished ? profile.publishedContent ?? {} : {};
  const published = Boolean(profile?.isPublished);
  const chain = schoolAncestors(hierarchy, school.id).reverse();
  const hero = content.heroMediaId ? withBasePath(`/api/pr-media/${content.heroMediaId}`) : null;

  return (
    <main className="public-page">
      <header className="public-hero" style={hero ? { backgroundImage: `linear-gradient(180deg, rgba(10,12,30,.35), rgba(10,12,30,.78)), url(${hero})` } : undefined}>
        <nav className="public-nav">
          <span className="brand"><span className="brand-mark">F</span> Forma</span>
          <span className="inline-actions">
            <Link href="/verify">Verify a certificate</Link>
            <Link className="public-signin" href="/login">Sign in</Link>
          </span>
        </nav>
        <div className="public-hero-copy">
          {chain.length > 0 && <p className="public-chain">{chain.map((unit) => <span key={unit.id} title={ORG_LEVEL_LABELS[unit.level]}>{unit.name}</span>)}</p>}
          <h1>{school.name}</h1>
          {content.tagline && <p className="public-tagline">{content.tagline}</p>}
          <div className="public-cta">
            {school.studentRegistrationOpen && <Link className="primary-button" href={`/${school.slug}/join`}>Register as a student</Link>}
            <Link className="secondary-button" href="/login">Student & staff sign in</Link>
          </div>
        </div>
      </header>

      <div className="public-body">
        <section className="public-stats" aria-label="At a glance">
          <div><strong>{studentCount?.value ?? 0}</strong><span>students</span></div>
          <div><strong>{teacherCount?.value ?? 0}</strong><span>teachers</span></div>
          {school.kebele && <div><strong>{school.kebele}</strong><span>kebele</span></div>}
          {school.schoolCode && <div><strong>{school.schoolCode}</strong><span>school code</span></div>}
        </section>

        {!published && <section className="public-card"><p>{school.name} has not published its full profile yet.</p></section>}

        {(content.about || content.mission || content.vision) && (
          <section className="public-card public-about">
            {content.about && <><h2>About us</h2><p>{content.about}</p></>}
            <div className="public-columns">
              {content.mission && <div><h3>Mission</h3><p>{content.mission}</p></div>}
              {content.vision && <div><h3>Vision</h3><p>{content.vision}</p></div>}
            </div>
          </section>
        )}

        {content.principalMessage && (
          <section className="public-card">
            <h2>From the principal</h2>
            <blockquote>{content.principalMessage}</blockquote>
            {content.principalName && <p className="public-signoff">— {content.principalName}</p>}
          </section>
        )}

        {posts.length > 0 && (
          <section className="public-card">
            <h2>News & announcements</h2>
            <div className="public-posts">{posts.map((post) => (
              <article key={post.id}>
                {post.coverMediaId && <img alt="" loading="lazy" src={withBasePath(`/api/pr-media/${post.coverMediaId}`)} />}
                <small>{humanize(post.postType)} · {post.publishedAt?.toISOString().slice(0, 10)}</small>
                <h3>{post.title}</h3>
                <p>{post.summary}</p>
              </article>
            ))}</div>
          </section>
        )}

        {events.length > 0 && (
          <section className="public-card">
            <h2>Upcoming events</h2>
            <ul className="public-events">{events.map((event) => (
              <li key={event.id}><time dateTime={event.eventDate}>{event.eventDate}{event.startTime ? ` ${event.startTime}` : ""}</time><strong>{event.title}</strong>{event.location && <span>{event.location}</span>}</li>
            ))}</ul>
          </section>
        )}

        {published && media.length > 0 && (
          <section className="public-card">
            <h2>Gallery</h2>
            <div className="public-gallery">{media.map((item) => <figure key={item.id}><img alt={item.caption ?? ""} loading="lazy" src={withBasePath(`/api/pr-media/${item.id}`)} />{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</div>
          </section>
        )}

        {(content.address || content.phone || content.email) && (
          <section className="public-card">
            <h2>Contact</h2>
            <ul className="public-contact">
              {content.address && <li>{content.address}</li>}
              {content.phone && <li><a href={`tel:${content.phone}`}>{content.phone}</a></li>}
              {content.email && <li><a href={`mailto:${content.email}`}>{content.email}</a></li>}
            </ul>
          </section>
        )}
      </div>
      <footer className="public-footer">{school.name} · {chain.map((unit) => unit.name).join(" · ")}</footer>
    </main>
  );
}

export default function SchoolPublicPage({ params }: { params: Params }) {
  return <Suspense fallback={<main className="public-page"><p className="public-loading">Loading…</p></main>}><SchoolProfile params={params} /></Suspense>;
}
