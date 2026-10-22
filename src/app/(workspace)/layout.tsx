import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";
import type { SchoolRole } from "@/lib/permissions";
import { getWorkspaceContext } from "@/lib/workspace";

// Prevent Next.js prefetch from rendering this auth-gated layout and
// reporting the expected redirect(/login) as an error in the server logs.
export const dynamic = "force-dynamic";

const roleLabels: Record<SchoolRole, string> = {
  school_admin: "School administrator",
  teacher: "Teacher",
  inventory_manager: "Inventory manager",
  hr_manager: "HR manager",
  student: "Student",
  guardian: "Guardian",
};
const rolePriority: SchoolRole[] = ["school_admin", "teacher", "inventory_manager", "hr_manager", "student", "guardian"];

async function Workspace({ children }: { children: ReactNode }) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login");

  const topRole = rolePriority.find((role) => context.roles.some((membership) => membership.role === role));
  const roleLabel = context.platformAdmin ? "Platform administrator" : topRole ? roleLabels[topRole] : "Member";

  return (
    <AppShell
      access={context.access}
      schools={context.schools}
      user={{ name: context.userName, email: context.userEmail, roleLabel }}
    >
      {children}
    </AppShell>
  );
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton withShell />}>
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}
