// The privilege matrix: which actions each role may take on each part of the app. No server-only
// imports, so the privileges page's client controls read the same lists the server enforces.
//
// Resolution for a role at a school, most specific first: the school's own override, then each
// hierarchy unit above it (cluster → woreda → zone → region), then the super administrator's
// platform default, then DEFAULT_PRIVILEGES below.
import { SCHOOL_ROLES, type SchoolRoleName } from "@/lib/roles";

export const PRIVILEGE_ACTIONS = ["read", "add", "edit", "delete", "approve", "import", "export", "manage"] as const;
export type PrivilegeAction = (typeof PRIVILEGE_ACTIONS)[number];

export const ACTION_LABELS: Record<PrivilegeAction, string> = {
  read: "View",
  add: "Add / write",
  edit: "Edit / modify",
  delete: "Delete",
  approve: "Approve",
  import: "Import",
  export: "Export",
  manage: "Manage (all)",
};

export const PRIVILEGE_RESOURCES = [
  { key: "students", label: "Students", group: "People" },
  { key: "teachers", label: "Teachers", group: "People" },
  { key: "staff", label: "Staff & HR records", group: "People" },
  { key: "applications", label: "Student applications", group: "People" },
  { key: "team", label: "Team members & roles", group: "Access" },
  { key: "privileges", label: "Role privileges", group: "Access" },
  { key: "hierarchy", label: "Clusters & hierarchy", group: "Access" },
  { key: "school_profile", label: "School profile & public page", group: "Access" },
  { key: "attendance", label: "Attendance", group: "Teaching" },
  { key: "assessments", label: "Assessments & results", group: "Teaching" },
  { key: "lessons", label: "Lesson plans", group: "Teaching" },
  { key: "resources", label: "Learning resources", group: "Teaching" },
  { key: "discussions", label: "Discussions", group: "Teaching" },
  { key: "data_fields", label: "Data field definitions", group: "Data" },
  { key: "field_data", label: "Data field values", group: "Data" },
  { key: "reports", label: "Reports & analytics", group: "Data" },
  { key: "certificates", label: "Certificates", group: "Data" },
  { key: "inventory", label: "Inventory", group: "Operations" },
  { key: "library", label: "Library", group: "Operations" },
] as const;
export type PrivilegeResource = (typeof PRIVILEGE_RESOURCES)[number]["key"];

export const RESOURCE_KEYS = PRIVILEGE_RESOURCES.map((resource) => resource.key) as PrivilegeResource[];

export type PrivilegeSet = Partial<Record<PrivilegeResource, PrivilegeAction[]>>;

const ALL: PrivilegeAction[] = ["manage"];
const VIEW: PrivilegeAction[] = ["read"];
const VIEW_EXPORT: PrivilegeAction[] = ["read", "export"];
const WORK: PrivilegeAction[] = ["read", "add", "edit", "export"];

/** Built-in defaults. They match what each role could do before privileges were configurable. */
export const DEFAULT_PRIVILEGES: Record<SchoolRoleName, PrivilegeSet> = {
  school_admin: Object.fromEntries(PRIVILEGE_RESOURCES.map(({ key }) => [key, ALL])) as PrivilegeSet,
  supervisor: {
    students: VIEW_EXPORT,
    teachers: VIEW_EXPORT,
    staff: VIEW,
    attendance: VIEW_EXPORT,
    assessments: VIEW_EXPORT,
    lessons: ["read", "approve"],
    resources: VIEW,
    discussions: ["read", "add"],
    data_fields: VIEW,
    field_data: ["read", "add", "edit", "import", "export"],
    reports: ["read", "add", "export"],
    certificates: VIEW,
    hierarchy: VIEW,
    school_profile: VIEW,
  },
  teacher: {
    students: VIEW,
    teachers: VIEW,
    attendance: WORK,
    assessments: WORK,
    lessons: WORK,
    resources: WORK,
    discussions: ["read", "add", "edit", "approve"],
    field_data: ["read", "add", "edit"],
    reports: ["read", "add", "export"],
    certificates: VIEW,
  },
  student: {
    discussions: ["read", "add"],
    certificates: VIEW,
    resources: VIEW,
  },
  guardian: {
    certificates: VIEW,
  },
  inventory_manager: { inventory: ALL, reports: VIEW },
  hr_manager: { staff: ALL, teachers: WORK, reports: VIEW_EXPORT, certificates: ["read", "add"] },
  librarian: { library: ALL, resources: VIEW },
  lab_technician: { resources: VIEW },
  workshop_manager: { resources: VIEW },
  community_officer: { discussions: ["read", "add"], school_profile: VIEW },
  pr_officer: { school_profile: ["read", "add", "edit"], discussions: VIEW },
};

/** Whether an action list allows `action`. "manage" allows every action. */
export function allows(actions: readonly string[] | undefined, action: PrivilegeAction) {
  return Boolean(actions && (actions.includes(action) || actions.includes("manage")));
}

export function isPrivilegeAction(value: string): value is PrivilegeAction {
  return (PRIVILEGE_ACTIONS as readonly string[]).includes(value);
}

export function isPrivilegeResource(value: string): value is PrivilegeResource {
  return (RESOURCE_KEYS as string[]).includes(value);
}

/** Roles whose privileges can be configured, most senior first. */
export const CONFIGURABLE_ROLES = SCHOOL_ROLES;
