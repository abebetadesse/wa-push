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
  library: boolean;
  lab: boolean;
  workshop: boolean;
  community: boolean;
  pr: boolean;
  /** Has a student membership (the My learning portal). */
  student: boolean;
  /** Clusters and the Region → Zone → Woreda → Cluster hierarchy. */
  organization: boolean;
  /** The role privilege matrix. */
  privileges: boolean;
  /** The report builder and dashboards. */
  analytics: boolean;
  /** Dynamic data fields and their values. */
  dataFields: boolean;
  certificates: boolean;
  discussions: boolean;
  /** Student account applications from the public page. */
  applications: boolean;
};

export type NavIcon =
  | "grid" | "users" | "teacher" | "book" | "folder" | "quiz" | "calendar" | "check"
  | "chart" | "layers" | "team" | "box" | "briefcase" | "school" | "graduation"
  | "shelf" | "flask" | "wrench" | "handshake" | "megaphone"
  | "network" | "shield" | "sliders" | "pie" | "award" | "chat" | "inbox" | "trend";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: NavIcon;
  section: "Overview" | "Teaching" | "Data & reports" | "Administration" | "Operations" | "Engagement";
  keywords?: string;
  allow: (access: WorkspaceAccess) => boolean;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Workspace overview and recent activity", icon: "grid", section: "Overview", keywords: "home overview", allow: (a) => a.dashboard },
  { href: "/my-learning", label: "My learning", description: "Your assessments, results and resources", icon: "graduation", section: "Overview", keywords: "student portal quiz results", allow: (a) => a.student },
  { href: "/my-progress", label: "My progress", description: "Your attendance, results and certificates", icon: "trend", section: "Overview", keywords: "student performance grades certificates", allow: (a) => a.student },
  { href: "/discussions", label: "Discussions", description: "Ask, answer and talk with your school", icon: "chat", section: "Overview", keywords: "forum chat questions class talk", allow: (a) => a.discussions },
  { href: "/students", label: "Students", description: "Roster, enrollment and report cards", icon: "users", section: "Teaching", keywords: "pupils roster register import csv", allow: (a) => a.academics },
  { href: "/teachers", label: "Teachers", description: "Teaching staff and their schedules", icon: "teacher", section: "Teaching", keywords: "staff instructors", allow: (a) => a.academics },
  { href: "/lessons", label: "Lesson plans", description: "Draft, review and publish lessons", icon: "book", section: "Teaching", keywords: "learning plans curriculum", allow: (a) => a.academics },
  { href: "/textbooks", label: "Textbooks", description: "Official textbooks for each grade and subject", icon: "book", section: "Teaching", keywords: "curriculum books moe grade subject pdf", allow: (a) => a.academics },
  { href: "/studio", label: "AI Studio", description: "Prepare lessons, notes, assignments and exams from a textbook", icon: "layers", section: "Teaching", keywords: "ai claude generate lesson plan lecture notes assignment exam", allow: (a) => a.academics },
  { href: "/resources", label: "Resources", description: "Learning materials and files", icon: "folder", section: "Teaching", keywords: "files uploads documents materials", allow: (a) => a.academics },
  { href: "/assessments", label: "Quizzes & tests", description: "Create assessments and record results", icon: "quiz", section: "Teaching", keywords: "assessments exams marks scores moodle", allow: (a) => a.academics },
  { href: "/timetable", label: "Timetable", description: "Weekly class schedule", icon: "calendar", section: "Teaching", keywords: "schedule periods", allow: (a) => a.academics },
  { href: "/attendance", label: "Attendance", description: "Take and review daily attendance", icon: "check", section: "Teaching", keywords: "register present absent roll call", allow: (a) => a.academics },
  { href: "/reports", label: "Results & reports", description: "Performance and attendance reports", icon: "chart", section: "Teaching", keywords: "grades analytics report cards", allow: (a) => a.academics },
  { href: "/analytics", label: "Analytics", description: "Build reports and dashboards across schools and clusters", icon: "pie", section: "Data & reports", keywords: "power bi dashboard chart pivot report builder statistics", allow: (a) => a.analytics },
  { href: "/data-fields", label: "Data fields", description: "Custom fields, data collection forms and imports", icon: "sliders", section: "Data & reports", keywords: "custom fields census form data collection csv template", allow: (a) => a.dataFields },
  { href: "/certificates", label: "Certificates", description: "Design and issue certificates for students and staff", icon: "award", section: "Data & reports", keywords: "award certificate template print verify", allow: (a) => a.certificates },
  { href: "/organization", label: "Clusters & hierarchy", description: "Regions, zones, woredas, clusters and their schools", icon: "network", section: "Administration", keywords: "cluster woreda zone region add cluster supervisor hierarchy", allow: (a) => a.organization },
  { href: "/organization/add-cluster", label: "Add a cluster", description: "Create a school cluster in a woreda and list its schools", icon: "school", section: "Administration", keywords: "new cluster create cluster woreda schools", allow: (a) => a.organization },
  { href: "/privileges", label: "Roles & privileges", description: "What each role may view, add, edit, delete and manage", icon: "shield", section: "Administration", keywords: "permissions rbac access rights roles privileges", allow: (a) => a.privileges },
  { href: "/applications", label: "Student applications", description: "Approve students who registered on the public page", icon: "inbox", section: "Administration", keywords: "register student signup approve applications", allow: (a) => a.applications },
  { href: "/academic-setup", label: "Academic setup", description: "Years, grades, subjects and classes", icon: "layers", section: "Administration", keywords: "academic year grade subject class structure", allow: (a) => a.schoolAdmin },
  { href: "/team", label: "Team & access", description: "Invite staff and manage roles", icon: "team", section: "Administration", keywords: "invite members roles permissions", allow: (a) => a.schoolAdmin },
  { href: "/setup-school", label: "Add a school", description: "Create a new school workspace", icon: "school", section: "Administration", keywords: "new school create workspace", allow: (a) => a.platformAdmin },
  { href: "/inventory", label: "Inventory", description: "Stock, supplies and movements", icon: "box", section: "Operations", keywords: "stock supplies assets", allow: (a) => a.inventory },
  { href: "/hr", label: "Human resources", description: "Staff records, leave, contracts and attendance", icon: "briefcase", section: "Operations", keywords: "hr staff employees leave contract attendance", allow: (a) => a.hr },
  { href: "/library", label: "Library", description: "Book catalog, copies and loans", icon: "shelf", section: "Operations", keywords: "books borrow loans return overdue", allow: (a) => a.library },
  { href: "/lab", label: "Laboratories", description: "Equipment, chemicals, bookings and safety", icon: "flask", section: "Operations", keywords: "laboratory science chemicals equipment booking incident", allow: (a) => a.lab },
  { href: "/workshop", label: "Workshops", description: "Tools, sessions and maintenance", icon: "wrench", section: "Operations", keywords: "technical vocational tools maintenance booking", allow: (a) => a.workshop },
  { href: "/community", label: "Community", description: "Partners, events, meetings and volunteers", icon: "handshake", section: "Engagement", keywords: "parents ptsa partners volunteers events meetings", allow: (a) => a.community },
  { href: "/pr", label: "Public relations", description: "News, announcements and the public school page", icon: "megaphone", section: "Engagement", keywords: "news announcements media website public page", allow: (a) => a.pr },
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
