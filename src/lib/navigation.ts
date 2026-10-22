// Navigation shared by the sidebar, the command palette, and the dashboard. Each entry names who
// may open it. WorkspaceAccess is built from the role lists the pages themselves check (`pageRoles` in
// lib/workspace.ts), so no link leads to /no-access.

export type WorkspaceAccess = {
  platformAdmin: boolean;
  /** Staff dashboard: school admins, teachers, inventory and HR managers. */
  dashboard: boolean;
  /** Teaching pages: school admins and teachers. */
  academics: boolean;
  /** School administration: school admins (and platform admins). */
  schoolAdmin: boolean;
  inventory: boolean;
  hr: boolean;
  /** Has a student membership (the My learning portal). */
  student: boolean;
};

export type NavIcon =
  | "grid" | "users" | "teacher" | "book" | "folder" | "quiz" | "calendar" | "check"
  | "chart" | "layers" | "team" | "box" | "briefcase" | "school" | "graduation";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: NavIcon;
  section: "Overview" | "Teaching" | "Administration" | "Operations";
  keywords?: string;
  allow: (access: WorkspaceAccess) => boolean;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Workspace overview and recent activity", icon: "grid", section: "Overview", keywords: "home overview", allow: (a) => a.dashboard },
  { href: "/my-learning", label: "My learning", description: "Your assessments, results and resources", icon: "graduation", section: "Overview", keywords: "student portal quiz results", allow: (a) => a.student },
  { href: "/students", label: "Students", description: "Roster, enrollment and report cards", icon: "users", section: "Teaching", keywords: "pupils roster register import csv", allow: (a) => a.academics },
  { href: "/teachers", label: "Teachers", description: "Teaching staff and their schedules", icon: "teacher", section: "Teaching", keywords: "staff instructors", allow: (a) => a.academics },
  { href: "/lessons", label: "Lesson plans", description: "Draft, review and publish lessons", icon: "book", section: "Teaching", keywords: "learning plans curriculum", allow: (a) => a.academics },
  { href: "/resources", label: "Resources", description: "Learning materials and files", icon: "folder", section: "Teaching", keywords: "files uploads documents materials", allow: (a) => a.academics },
  { href: "/assessments", label: "Quizzes & tests", description: "Create assessments and record results", icon: "quiz", section: "Teaching", keywords: "assessments exams marks scores moodle", allow: (a) => a.academics },
  { href: "/timetable", label: "Timetable", description: "Weekly class schedule", icon: "calendar", section: "Teaching", keywords: "schedule periods", allow: (a) => a.academics },
  { href: "/attendance", label: "Attendance", description: "Take and review daily attendance", icon: "check", section: "Teaching", keywords: "register present absent roll call", allow: (a) => a.academics },
  { href: "/reports", label: "Results & reports", description: "Performance and attendance reports", icon: "chart", section: "Teaching", keywords: "grades analytics report cards", allow: (a) => a.academics },
  { href: "/academic-setup", label: "Academic setup", description: "Years, grades, subjects and classes", icon: "layers", section: "Administration", keywords: "academic year grade subject class structure", allow: (a) => a.schoolAdmin },
  { href: "/team", label: "Team & access", description: "Invite staff and manage roles", icon: "team", section: "Administration", keywords: "invite members roles permissions", allow: (a) => a.schoolAdmin },
  { href: "/setup-school", label: "Add a school", description: "Create a new school workspace", icon: "school", section: "Administration", keywords: "new school create workspace", allow: (a) => a.platformAdmin },
  { href: "/inventory", label: "Inventory", description: "Stock, supplies and movements", icon: "box", section: "Operations", keywords: "stock supplies assets", allow: (a) => a.inventory },
  { href: "/hr", label: "Human resources", description: "Staff records and employment status", icon: "briefcase", section: "Operations", keywords: "hr staff employees", allow: (a) => a.hr },
];

export function visibleNavItems(access: WorkspaceAccess) {
  return navItems.filter((item) => item.allow(access));
}

/** The nav entry a pathname belongs to: an exact match, else the longest matching prefix. */
export function activeNavItem(pathname: string, items: NavItem[]) {
  return items
    .filter((item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
