// Placeholder while the workspace or a page loads. Pure markup, so it can render on the server.
export function PageSkeleton({ withShell = false }: { withShell?: boolean }) {
  const page = (
    <main className="management-page skeleton-page" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton-line" style={{ width: 120 }} />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" style={{ width: "min(420px, 80%)" }} />
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((index) => <div className="skeleton skeleton-card" key={index} />)}
      </div>
      <div className="skeleton skeleton-panel" />
    </main>
  );
  if (!withShell) return page;
  return (
    <div className="app-shell">
      <aside className="sidebar skeleton-sidebar" aria-hidden="true">
        <span className="brand"><span className="brand-mark">f</span><span className="brand-name">forma<span className="brand-dot">.</span></span></span>
        <div className="skeleton skeleton-switcher" />
        {[0, 1, 2, 3, 4, 5, 6].map((index) => <div className="skeleton skeleton-nav" key={index} />)}
      </aside>
      <div className="main-panel">
        <header className="topbar"><div className="skeleton skeleton-line" style={{ width: 160 }} /></header>
        <div className="content">{page}</div>
      </div>
    </div>
  );
}
