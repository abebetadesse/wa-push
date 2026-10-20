import Link from "next/link";
import { ArrowIcon, ChevronIcon, NavGlyph } from "@/components/icons";
import { RelativeTime } from "@/components/relative-time";
import { initials } from "@/lib/format";
import { visibleNavItems, type NavIcon, type WorkspaceAccess } from "@/lib/navigation";

export type DashboardSchool = {
  id: string;
  name: string;
  country: string | null;
  students: number;
  classes: number;
  lessons: number;
  teachers: number;
};

export type DashboardActivity = {
  id: string;
  name: string;
  detail: string;
  schoolName: string;
  createdAt: string;
};

export type SetupStep = { label: string; href: string; done: number; total: number };

type Stats = {
  students: number;
  classes: number;
  lessons: number;
  teachers: number;
  awaitingReview: number;
  liveAssessments: number;
  attendanceRate: number | null;
  attendanceRecorded: number;
};

const tones = ["violet", "blue", "orange", "green"] as const;

export default function Dashboard({
  access,
  activity,
  schools,
  setupSteps,
  stats,
  userName,
}: {
  access: WorkspaceAccess;
  activity: DashboardActivity[];
  schools: DashboardSchool[];
  setupSteps: SetupStep[];
  stats: Stats;
  userName: string;
}) {
  const metrics: { label: string; value: string; note: string; icon: NavIcon; href?: string }[] = [
    { label: "Active students", value: stats.students.toLocaleString(), note: `Across ${schools.length} school${schools.length === 1 ? "" : "s"}`, icon: "users", href: access.academics ? "/students" : undefined },
    { label: "Teachers", value: stats.teachers.toLocaleString(), note: `${stats.classes.toLocaleString()} classes running`, icon: "teacher", href: access.academics ? "/teachers" : undefined },
    { label: "Lesson plans", value: stats.lessons.toLocaleString(), note: stats.awaitingReview ? `${stats.awaitingReview} awaiting review` : "None awaiting review", icon: "book", href: access.academics ? "/lessons" : undefined },
    { label: "Attendance · 7 days", value: stats.attendanceRate === null ? "—" : `${stats.attendanceRate}%`, note: stats.attendanceRecorded ? `${stats.attendanceRecorded.toLocaleString()} marks recorded` : "No attendance taken yet", icon: "check", href: access.academics ? "/attendance" : undefined },
  ];
  const completedSteps = setupSteps.filter((step) => step.done >= step.total).length;
  const showSetup = setupSteps.length > 0 && completedSteps < setupSteps.length;
  const shortcuts = visibleNavItems(access).filter((item) => item.href !== "/").slice(0, 6);
  const firstName = userName.trim().split(/\s+/)[0] || "there";

  return (
    <main className="dashboard-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="live-dot" /> School workspace</div>
          <h1>Welcome back, {firstName}</h1>
          <p>Here is what is happening across your school{schools.length === 1 ? "" : "s"} today.</p>
        </div>
        <div className="welcome-actions">
          {access.academics && <Link className="secondary-button" href="/attendance">Take attendance</Link>}
          {access.academics && <Link className="primary-button" href="/lessons"><span aria-hidden="true">＋</span> New lesson plan</Link>}
          {!access.academics && access.platformAdmin && <Link className="primary-button" href="/setup-school"><span aria-hidden="true">＋</span> Add a school</Link>}
        </div>
      </section>

      <section className="metric-grid" aria-label="Key figures">
        {metrics.map((metric, index) => {
          const body = <>
            <div className="metric-top"><span>{metric.label}</span><span className={`metric-icon ${tones[index % tones.length]}`}><NavGlyph name={metric.icon} size={16} /></span></div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-change">{metric.note}</div>
          </>;
          return metric.href
            ? <Link className="metric-card metric-link" href={metric.href} key={metric.label}>{body}</Link>
            : <article className="metric-card" key={metric.label}>{body}</article>;
        })}
      </section>

      {(stats.awaitingReview > 0 && access.schoolAdmin) || stats.liveAssessments > 0 ? (
        <section className="attention-strip" aria-label="Needs attention">
          {stats.awaitingReview > 0 && access.schoolAdmin && (
            <Link className="attention-item" href="/lessons"><span className="attention-dot warn" />{stats.awaitingReview} lesson plan{stats.awaitingReview === 1 ? " is" : "s are"} waiting for your review <ArrowIcon /></Link>
          )}
          {stats.liveAssessments > 0 && access.academics && (
            <Link className="attention-item" href="/assessments"><span className="attention-dot live" />{stats.liveAssessments} assessment{stats.liveAssessments === 1 ? " is" : "s are"} open to students <ArrowIcon /></Link>
          )}
        </section>
      ) : null}

      {showSetup && (
        <section className="panel setup-panel" aria-labelledby="setup-heading">
          <div className="panel-heading">
            <div><h2 id="setup-heading">Finish setting up</h2><p>{completedSteps} of {setupSteps.length} steps complete — each one unlocks more of Forma.</p></div>
            <span className="setup-progress-label">{Math.round((completedSteps / setupSteps.length) * 100)}%</span>
          </div>
          <div className="schedule-track" aria-hidden="true"><span style={{ width: `${(completedSteps / setupSteps.length) * 100}%` }} /></div>
          <ol className="setup-steps">
            {setupSteps.map((step) => {
              const complete = step.done >= step.total;
              return (
                <li key={step.label} className={complete ? "done" : ""}>
                  <Link href={step.href}>
                    <span className="step-check" aria-hidden="true">{complete ? "✓" : ""}</span>
                    <span>{step.label}</span>
                    {step.total > 1 && <small>{step.done}/{step.total} schools</small>}
                    <span className="visually-hidden">{complete ? "(done)" : "(to do)"}</span>
                    <ChevronIcon />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel schools-panel" id="schools">
          <div className="panel-heading">
            <div><h2>Your schools</h2><p>Schools you are authorized to manage</p></div>
            {access.platformAdmin && <Link href="/setup-school" className="text-link">Add school <ArrowIcon /></Link>}
          </div>
          <div className="school-list">
            {schools.map((school, index) => (
              <div className="school-row" key={school.id}>
                <span className={`school-avatar ${["purple", "blue", "orange"][index % 3]}`}>{initials(school.name)}</span>
                <span className="school-details"><strong>{school.name}</strong><small>{school.country || "Country not set"} · {school.classes} classes · {school.teachers} teachers</small></span>
                <span className="student-total"><strong>{school.students.toLocaleString()}</strong><small>students</small></span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel activity-panel">
          <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from your schools</p></div></div>
          {activity.length === 0 ? <p className="empty-state">No activity yet. Registering students, saving lessons and taking attendance will show up here.</p> : <ol className="activity-list">
            {activity.map((item) => (
              <li className="activity-row" key={item.id}>
                <span className="avatar lavender">{initials(item.name)}</span>
                <div className="activity-copy"><strong>{item.name}</strong><p>{item.detail}</p><small>{item.schoolName} · <RelativeTime value={item.createdAt} /></small></div>
              </li>
            ))}
          </ol>}
        </article>
      </section>

      {shortcuts.length > 0 && (
        <section className="panel quick-panel">
          <div className="panel-heading"><div><h2>Jump to</h2><p>Everything your role can open — or press <kbd>Ctrl K</kbd> to search</p></div></div>
          <div className="quick-actions">
            {shortcuts.map((item, index) => (
              <Link className="quick-action" href={item.href} key={item.href}>
                <span className={`quick-icon ${index % 2 ? "quick-blue" : "quick-purple"}`}><NavGlyph name={item.icon} size={17} /></span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                <ChevronIcon />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
