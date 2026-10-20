import Link from "next/link";

// Shown inside the workspace shell when a record (student, lesson, teacher…) does not exist or
// belongs to a school the member cannot see.
export default function WorkspaceNotFound() {
  return (
    <main className="management-page">
      <section className="management-card status-card">
        <p className="status-page-code">404</p>
        <h1>We couldn’t find that</h1>
        <p className="management-description">This record doesn’t exist, was removed, or belongs to a school you don’t have access to.</p>
        <div className="inline-actions">
          <Link className="primary-button" href="/">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
