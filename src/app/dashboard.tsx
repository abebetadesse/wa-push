"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

export type DashboardSchool = {
  id: string;
  name: string;
  country: string | null;
  students: number;
  classes: number;
  lessons: number;
};

export type DashboardActivity = {
  id: string;
  name: string;
  detail: string;
  schoolName: string;
  createdAt: string;
};

export default function Dashboard({
  activity,
  isPlatformAdmin,
  isStaff,
  isStudent,
  isInventoryManager,
  isHrManager,
  userName,
  schools,
}: {
  activity: DashboardActivity[];
  isPlatformAdmin: boolean;
  isStaff: boolean;
  isStudent: boolean;
  isInventoryManager: boolean;
  isHrManager: boolean;
  userName: string;
  schools: DashboardSchool[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  const studentTotal = schools.reduce((total, school) => total + school.students, 0);
  const classTotal = schools.reduce((total, school) => total + school.classes, 0);
  const lessonTotal = schools.reduce((total, school) => total + school.lessons, 0);
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  const metrics = [
    { label: "Schools", value: schools.length.toLocaleString(), change: "In your workspace", icon: "▦", tone: "violet" },
    { label: "Students", value: studentTotal.toLocaleString(), change: "Across your schools", icon: "♙", tone: "blue" },
    { label: "Classes", value: classTotal.toLocaleString(), change: "Across academic years", icon: "▤", tone: "orange" },
    { label: "Lessons", value: lessonTotal.toLocaleString(), change: "Saved lesson plans", icon: "✓", tone: "green" },
  ];

  return (
    <main className="app-shell">
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <Link className="brand" href="/" onClick={closeSidebar} aria-label="Forma home">
            <span className="brand-mark">f</span><span>forma<span className="brand-dot">.</span></span>
          </Link>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={closeSidebar}
            aria-label="Close navigation menu"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="school-switcher">
          <span className="switcher-icon"><SchoolIcon /></span>
          <span className="switcher-copy"><strong>{schools.length === 1 ? schools[0].name : "My schools"}</strong><small>{schools.length} school{schools.length === 1 ? "" : "s"}</small></span>
        </div>
        <div className="nav-label">OVERVIEW</div>
        <nav className="nav-list" aria-label="Main navigation">
          <Link className="nav-link active" href="/" onClick={closeSidebar}><GridIcon /><span>Dashboard</span></Link>
          <a className="nav-link" href="#schools" onClick={closeSidebar}><SchoolIcon /><span>Schools</span><span className="nav-count">{schools.length}</span></a>
          <Link className="nav-link" href="/students" onClick={closeSidebar}><UsersIcon /><span>Students</span></Link>
          <Link className="nav-link" href="/lessons" onClick={closeSidebar}><BookIcon /><span>Learning</span></Link>
          <Link className="nav-link" href="/resources" onClick={closeSidebar}><BookIcon /><span>Resources</span></Link>
          <Link className="nav-link" href="/assessments" onClick={closeSidebar}><ChartIcon /><span>Quizzes &amp; tests</span></Link>
          {isStudent && <Link className="nav-link" href="/my-learning" onClick={closeSidebar}><BookIcon /><span>My assessments</span></Link>}
          <Link className="nav-link" href="/team" onClick={closeSidebar}><UsersIcon /><span>Team</span></Link>
          {isStaff && <Link className="nav-link" href="/teachers" onClick={closeSidebar}><UsersIcon /><span>Teachers</span></Link>}
          {isStaff && <Link className="nav-link" href="/timetable" onClick={closeSidebar}><CalendarIcon /><span>Timetable</span></Link>}
          {isStaff && <Link className="nav-link" href="/attendance" onClick={closeSidebar}><CalendarIcon /><span>Attendance</span></Link>}
          {isStaff && <Link className="nav-link" href="/reports" onClick={closeSidebar}><ChartIcon /><span>Results &amp; reports</span></Link>}
        </nav>
        <div className="nav-label operations-label">OPERATIONS</div>
        <nav className="nav-list" aria-label="Operations navigation">
          {isInventoryManager && <Link className="nav-link" href="/inventory" onClick={closeSidebar}><BoxIcon /><span>Inventory</span></Link>}
          {isHrManager && <Link className="nav-link" href="/hr" onClick={closeSidebar}><BriefcaseIcon /><span>Human resources</span></Link>}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar avatar-admin">{initials}</div>
            <span className="profile-copy"><strong>{userName}</strong><small>{isPlatformAdmin ? "Platform administrator" : "School member"}</small></span>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <section className="main-panel" id="dashboard">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
            <div className="breadcrumb">Workspace <ChevronIcon /><strong>Dashboard</strong></div>
          </div>
          <div className="topbar-actions"><div className="avatar avatar-admin top-avatar" aria-label={userName}>{initials}</div></div>
        </header>
        <div className="content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> SCHOOL MANAGEMENT</div>
              <h1>Welcome, {userName.split(/\s+/)[0]} <span className="wave">✳</span></h1>
              <p>Here is the current overview of your school workspace.</p>
            </div>
            {isPlatformAdmin && <Link className="primary-button" href="/setup-school"><span>＋</span> Add a school</Link>}
          </section>

          <section className="metric-grid" aria-label="School statistics">
            {metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <div className="metric-top"><span>{metric.label}</span><span className={`metric-icon ${metric.tone}`}>{metric.icon}</span></div>
                <div className="metric-value">{metric.value}</div><div className="metric-change">{metric.change}</div>
              </article>
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel schools-panel" id="schools">
              <div className="panel-heading">
                <div><h2>Your schools</h2><p>Schools you are authorized to manage</p></div>
                {isPlatformAdmin && <Link href="/setup-school" className="text-link">Add school <ArrowIcon /></Link>}
              </div>
              <div className="school-list">
                {schools.map((school, index) => (
                  <div className="school-row" key={school.id}>
                    <span className={`school-avatar ${["purple", "blue", "orange"][index % 3]}`}>{school.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")}</span>
                    <span className="school-details"><strong>{school.name}</strong><small>{school.country || "Country not set"} · {school.classes} classes</small></span>
                    <span className="student-total"><strong>{school.students.toLocaleString()}</strong><small>students</small></span>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel activity-panel">
              <div className="panel-heading"><div><h2>Recent activity</h2><p>Updates from your authorized schools</p></div></div>
              {activity.length === 0 ? <p className="empty-state">No school activity has been recorded yet.</p> : <div className="activity-list">
                {activity.map((item) => <div className="activity-row" key={item.id}>
                  <span className="avatar lavender">{item.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")}</span>
                  <div className="activity-copy"><strong>{item.name}</strong><p>{item.detail}</p><small>{item.schoolName} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</small></div>
                </div>)}
              </div>}
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel schedule-panel">
              <div className="panel-heading"><div><h2>Academic setup</h2><p>Prepare the structure for your schools</p></div></div>
              <div className="quick-actions">
                <Link className="quick-action" href="/academic-setup"><span className="quick-icon quick-purple"><CalendarIcon /></span><span><strong>Academic structure</strong><small>Manage years, grades &amp; subjects</small></span><ChevronIcon /></Link>
                <Link className="quick-action" href="/team"><span className="quick-icon quick-blue"><UsersIcon /></span><span><strong>Manage school team</strong><small>Invite staff and assign roles</small></span><ChevronIcon /></Link>
              </div>
            </article>
            <article className="panel quick-panel">
              <div className="panel-heading"><div><h2>Quick actions</h2><p>Continue setting up your workspace</p></div></div>
              <div className="quick-actions">
                <Link className="quick-action" href="/students"><span className="quick-icon quick-purple"><UsersIcon /></span><span><strong>Register students</strong><small>Manage the student roster</small></span><ChevronIcon /></Link>
                <Link className="quick-action" href="/lessons"><span className="quick-icon quick-blue"><BookIcon /></span><span><strong>Create a lesson</strong><small>Plan and review lesson drafts</small></span><ChevronIcon /></Link>
                <Link className="quick-action" href="/assessments"><span className="quick-icon quick-purple"><ChartIcon /></span><span><strong>Create an assessment</strong><small>Quiz a class and record results</small></span><ChevronIcon /></Link>
              </div>
            </article>
          </section>
          <footer className="footer"><span>Forma Education Platform</span><span>Connected to MySQL <i className="live-dot" /></span></footer>
        </div>
      </section>
    </main>
  );
}

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function GridIcon() { return <Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>; }
function SchoolIcon() { return <Icon size={17}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></Icon>; }
function UsersIcon() { return <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>; }
function BookIcon() { return <Icon><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></Icon>; }
function CalendarIcon() { return <Icon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></Icon>; }
function ChartIcon() { return <Icon><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></Icon>; }
function BoxIcon() { return <Icon><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></Icon>; }
function BriefcaseIcon() { return <Icon><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></Icon>; }
function ChevronIcon() { return <Icon size={15}><path d="m9 18 6-6-6-6" /></Icon>; }
function ArrowIcon() { return <Icon size={15}><path d="M5 12h14M12 5l7 7-7 7" /></Icon>; }
function MenuIcon() { return <Icon size={18}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></Icon>; }
function CloseIcon() { return <Icon size={18}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>; }
