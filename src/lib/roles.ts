// Every school role, its label, and the groups the app checks. No server-only imports: the schema,
// server code and client forms all read this list, so a new role is added in one place.

export const SCHOOL_ROLES = [
  "school_admin",
  "supervisor",
  "teacher",
  "student",
  "guardian",
  "inventory_manager",
  "hr_manager",
  "librarian",
  "lab_technician",
  "workshop_manager",
  "community_officer",
  "pr_officer",
] as const;

export type SchoolRoleName = (typeof SCHOOL_ROLES)[number];

export const ROLE_LABELS: Record<SchoolRoleName, string> = {
  school_admin: "School administrator",
  supervisor: "Supervisor",
  teacher: "Teacher",
  student: "Student",
  guardian: "Guardian",
  inventory_manager: "Inventory manager",
  hr_manager: "Human resources manager",
  librarian: "Librarian",
  lab_technician: "Laboratory technician",
  workshop_manager: "Workshop manager",
  community_officer: "Community engagement officer",
  pr_officer: "Public relations officer",
};

/** Roles that work in the staff workspace, most senior first. */
export const STAFF_ROLES = [
  "school_admin",
  "supervisor",
  "teacher",
  "inventory_manager",
  "hr_manager",
  "librarian",
  "lab_technician",
  "workshop_manager",
  "community_officer",
  "pr_officer",
] as const satisfies readonly SchoolRoleName[];

export type StaffRoleName = (typeof STAFF_ROLES)[number];

/** Roles a school admin can invite by email. Guardians get access through their child (planned). */
export const INVITE_ROLES = [...STAFF_ROLES, "student"] as const satisfies readonly SchoolRoleName[];

export function isStaffRole(value: string): value is StaffRoleName {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

// The administrative hierarchy above schools, top first: Region → Zone → Woreda → School cluster.
// A cluster holds many schools; each school belongs to at most one cluster.
export const ORG_LEVELS = ["region", "zone", "woreda", "cluster"] as const;

export type OrgLevel = (typeof ORG_LEVELS)[number];

export const ORG_LEVEL_LABELS: Record<OrgLevel, string> = {
  region: "Region",
  zone: "Zone",
  woreda: "Woreda",
  cluster: "School cluster",
};

/** The level directly below `level`, or null for clusters (whose children are schools). */
export function childLevel(level: OrgLevel): OrgLevel | null {
  return ORG_LEVELS[ORG_LEVELS.indexOf(level) + 1] ?? null;
}

/**
 * Roles held over a hierarchy unit and every school below it. An organization admin acts as the school
 * administrator of each of those schools and manages the units below; a supervisor acts as the
 * schools' supervisor.
 */
export const ORG_ROLES = ["org_admin", "supervisor"] as const;

export type OrgRoleName = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRoleName, string> = {
  org_admin: "Administrator",
  supervisor: "Supervisor",
};

/** The school role an organization role gives at each school under its unit. */
export const ORG_ROLE_AT_SCHOOL: Record<OrgRoleName, SchoolRoleName> = {
  org_admin: "school_admin",
  supervisor: "supervisor",
};
