// Every school role, its label, and the groups the app checks. No server-only imports: the schema,
// server code and client forms all read this list, so a new role is added in one place.

export const SCHOOL_ROLES = [
  "school_admin",
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
