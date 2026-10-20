import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { learningResources, schoolMemberships } from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import { getAccessibleSchools, getSession, isPlatformAdmin } from "@/lib/permissions";
import { resourceFileType } from "@/lib/learning-resources";
import { ResourceUploadForm } from "./resource-upload-form";

export const metadata: Metadata = { title: "Learning resources | Forma" };

async function ResourcesContent() {
  const session = await getSession();
  if (!session) redirect("/login");
  const platformAdmin = isPlatformAdmin(session);
  const accessibleSchools = await getAccessibleSchools();
  const memberships = platformAdmin
    ? []
    : await db
      .select({ schoolId: schoolMemberships.schoolId, role: schoolMemberships.role })
      .from(schoolMemberships)
      .where(eq(schoolMemberships.userId, session.user.id));
  const allowedSchoolIds = platformAdmin
    ? accessibleSchools.map((school) => school.id)
    : memberships
      .filter(({ role }) => role === "school_admin" || role === "teacher")
      .map(({ schoolId }) => schoolId);
  if (!allowedSchoolIds.length) redirect("/no-access");

  const schools = accessibleSchools.filter((school) => allowedSchoolIds.includes(school.id));
  const resources = await db
    .select({
      id: learningResources.id,
      schoolId: learningResources.schoolId,
      title: learningResources.title,
      description: learningResources.description,
      fileName: learningResources.fileName,
      sizeBytes: learningResources.sizeBytes,
      createdAt: learningResources.createdAt,
    })
    .from(learningResources)
    .where(inArray(learningResources.schoolId, allowedSchoolIds))
    .orderBy(desc(learningResources.createdAt))
    .limit(100);

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">TEACHING &amp; LEARNING</p>
          <h1>Learning resources</h1>
          <p className="management-description">Share school learning materials across text, documents, images, audio, video, and animation.</p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Upload a resource</h2>
          <ResourceUploadForm schools={schools} />
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Resource library</h2><p>Latest 100 resources from your authorized schools</p></div></div>
          {resources.length === 0 ? <p className="empty-state">No learning resources have been uploaded yet.</p> : <div className="record-list">
            {resources.map((resource) => (
              <div className="record-row" key={resource.id}>
                <div className="record-primary">
                  <strong>{resource.title}</strong>
                  <small>{schools.find((school) => school.id === resource.schoolId)?.name} · {resourceFileType(resource.fileName)?.category ?? "Resource"} · {formatBytes(resource.sizeBytes)}</small>
                  <small>{resource.fileName}{resource.description ? ` · ${resource.description}` : ""}</small>
                </div>
                <a className="secondary-button record-action" href={withBasePath(`/api/resources/${resource.id}`)} rel="noreferrer" target="_blank">Open / download</a>
              </div>
            ))}
          </div>}
        </section>
      </div>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading learning resources...</p></main>}><ResourcesContent /></Suspense>;
}
