"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { basePath } from "@/lib/base-path";
import { initials } from "@/lib/format";
import { activeNavItem, visibleNavItems, type NavItem, type WorkspaceAccess } from "@/lib/navigation";
import { CommandPalette } from "./command-palette";
import { ChevronIcon, CloseIcon, CollapseIcon, LogoutIcon, MenuIcon, MoonIcon, NavGlyph, SearchIcon, SunIcon } from "./icons";
import { applyTheme, currentTheme, type Theme } from "./theme";

export type ShellUser = { name: string; email: string; roleLabel: string };
export type ShellSchool = { id: string; name: string; country: string | null };

const sidebarStorageKey = "forma-sidebar";

function subscribeToDocument(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-sidebar"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", callback);
  };
}

const isSidebarCollapsed = () => document.documentElement.dataset.sidebar === "collapsed";

export function AppShell({
  access,
  children,
  schools,
  user,
}: {
  access: WorkspaceAccess;
  children: ReactNode;
  schools: ShellSchool[];
  user: ShellUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = useMemo(() => visibleNavItems(access), [access]);
  const active = activeNavItem(pathname, items);
  const theme = useSyncExternalStore<Theme>(subscribeToDocument, currentTheme, () => "light");
  const collapsed = useSyncExternalStore(subscribeToDocument, isSidebarCollapsed, () => false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState("");
  const [shownPath, setShownPath] = useState(pathname);

  // A finished navigation closes the drawer and menus and ends the progress bar.
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setPendingPath(null);
    setDrawerOpen(false);
    setMenuOpen(false);
  }

  const toggleTheme = useCallback(() => applyTheme(currentTheme() === "dark" ? "light" : "dark"), []);
  const toggleSidebar = useCallback(() => {
    const next = isSidebarCollapsed() ? "expanded" : "collapsed";
    document.documentElement.dataset.sidebar = next;
    try {
      localStorage.setItem(sidebarStorageKey, next);
    } catch {
      // Storage may be unavailable; the choice still applies until the page reloads.
    }
  }, []);

  const signOut = useCallback(async () => {
    setSignOutError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setSignOutError("Sign out failed. Please try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out request failed.", error);
      setSignOutError("Sign out failed. Please try again.");
    }
  }, [router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === "Escape") {
        setDrawerOpen(false);
        setMenuOpen(false);
      }
    }
    // Any in-app link shows the progress bar until the next page renders.
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith(`${basePath}/api/`)) return;
      if (url.pathname !== window.location.pathname) setPendingPath(url.pathname);
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const sections = groupBySection(items);
  const subPage = active && pathname !== active.href ? subPageLabel(pathname) : null;
  const schoolLabel = schools.length === 1 ? schools[0].name : schools.length === 0 ? "No active school" : `${schools.length} schools`;

  return (
    <div className={`app-shell${collapsed ? " is-collapsed" : ""}`}>
      {pendingPath && <div className="route-progress" role="progressbar" aria-label="Loading page" />}
      <a className="skip-link" href="#main-content">Skip to content</a>
      {drawerOpen && <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <aside className={`sidebar${drawerOpen ? " sidebar-open" : ""}`} aria-label="Workspace navigation">
        <div className="sidebar-header">
          <Link className="brand" href={access.dashboard ? "/" : "/my-learning"} aria-label="Forma home">
            <span className="brand-mark">f</span><span className="brand-name">forma<span className="brand-dot">.</span></span>
          </Link>
          <button type="button" className="sidebar-close-btn" onClick={() => setDrawerOpen(false)} aria-label="Close navigation menu">
            <CloseIcon />
          </button>
        </div>

        <div className="school-switcher" title={schools.map((school) => school.name).join(", ")}>
          <span className="switcher-icon"><NavGlyph name="school" size={17} /></span>
          <span className="switcher-copy"><strong>{schoolLabel}</strong><small>{user.roleLabel}</small></span>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {sections.map(([section, sectionItems]) => (
            <div className="nav-group" key={section}>
              <div className="nav-label">{section}</div>
              <ul className="nav-list">
                {sectionItems.map((item) => {
                  const isActive = active?.href === item.href;
                  return (
                    <li key={item.href}>
                      <Link className={`nav-link${isActive ? " active" : ""}`} href={item.href} aria-current={isActive ? "page" : undefined} title={collapsed ? item.label : undefined}>
                        <NavGlyph name={item.icon} />
                        <span className="nav-text">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button type="button" className="nav-link collapse-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}>
            <CollapseIcon /><span className="nav-text">Collapse</span>
          </button>
          <div className="profile">
            <div className="avatar avatar-admin">{initials(user.name)}</div>
            <span className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></span>
            <button type="button" className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogoutIcon /></button>
          </div>
          {signOutError && <p className="signout-error" role="alert">{signOutError}</p>}
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-nav-toggle" onClick={() => setDrawerOpen((open) => !open)} aria-label={drawerOpen ? "Close menu" : "Open menu"} aria-expanded={drawerOpen}>
              {drawerOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <span className="crumb-muted">{active?.section ?? "Workspace"}</span>
              <ChevronIcon size={13} />
              {subPage && active ? (
                <><Link href={active.href}>{active.label}</Link><ChevronIcon size={13} /><strong>{subPage}</strong></>
              ) : <strong>{active?.label ?? "Workspace"}</strong>}
            </nav>
          </div>
          <div className="topbar-actions">
            <button type="button" className="search-box" onClick={() => setPaletteOpen(true)} aria-label="Search pages and actions" aria-keyshortcuts="Control+K Meta+K">
              <SearchIcon /><span>Search or jump to…</span><kbd>Ctrl K</kbd>
            </button>
            <button type="button" className="icon-button" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={theme === "dark" ? "Light theme" : "Dark theme"}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <div className="user-menu">
              <button type="button" className="avatar avatar-admin top-avatar" onClick={() => setMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Account menu for ${user.name}`}>
                {initials(user.name)}
              </button>
              {menuOpen && <>
                <div className="menu-dismiss" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div className="user-popover" role="menu">
                  <div className="user-popover-head">
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                    <span className="role-badge">{user.roleLabel}</span>
                  </div>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPaletteOpen(true); }}><SearchIcon /> Quick search</button>
                  <button type="button" role="menuitem" onClick={toggleTheme}>{theme === "dark" ? <SunIcon /> : <MoonIcon />} {theme === "dark" ? "Light theme" : "Dark theme"}</button>
                  <button type="button" role="menuitem" className="danger" onClick={signOut}><LogoutIcon /> Sign out</button>
                </div>
              </>}
            </div>
          </div>
        </header>
        {/* Each page renders its own <main>. */}
        <div className="content" id="main-content" tabIndex={-1}>
          {children}
        </div>
      </div>

      {paletteOpen && (
        <CommandPalette
          items={items}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(href) => {
            setPaletteOpen(false);
            if (href !== pathname) setPendingPath(href);
            router.push(href);
          }}
          onSignOut={signOut}
          onToggleTheme={toggleTheme}
          theme={theme}
        />
      )}
    </div>
  );
}

function groupBySection(items: NavItem[]) {
  const groups = new Map<NavItem["section"], NavItem[]>();
  for (const item of items) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
  return [...groups.entries()];
}

function subPageLabel(pathname: string) {
  if (pathname.endsWith("/report-card")) return "Report card";
  return "Details";
}
