export type LessonStatus = "draft" | "submitted" | "approved" | "published" | "archived";

// Teachers edit their own drafts; school admins can edit anything that is not archived.
export function canEditLesson({
  role,
  userId,
  platformAdmin,
  status,
  createdBy,
}: {
  role: string | undefined;
  userId: string;
  platformAdmin: boolean;
  status: LessonStatus;
  createdBy: string | null;
}) {
  if (status === "archived") return false;
  if (platformAdmin || role === "school_admin") return true;
  return role === "teacher" && createdBy === userId && status === "draft";
}

export const lessonSections = [
  { name: "overview", label: "Overview" },
  { name: "objectives", label: "Learning objectives" },
  { name: "prerequisites", label: "Prerequisites" },
  { name: "materials", label: "Materials and resources" },
  { name: "procedures", label: "Procedures" },
  { name: "differentiation", label: "Differentiation" },
  { name: "assessment", label: "Assessment" },
  { name: "homework", label: "Homework" },
  { name: "notes", label: "Teacher notes" },
] as const;
