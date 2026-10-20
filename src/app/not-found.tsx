import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found | Forma" };

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="status-page-code">404</p>
        <h1>Page not found</h1>
        <p className="auth-description">The page you’re looking for doesn’t exist or has moved. Check the address, or head back to your workspace.</p>
        <div className="no-access-actions">
          <Link className="primary-button" href="/">Go to my workspace</Link>
          <Link className="secondary-button" href="/login">Sign in</Link>
        </div>
      </section>
    </main>
  );
}
