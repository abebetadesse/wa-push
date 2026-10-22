import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import type { SchoolRole } from "@/lib/permissions";
import { getWorkspaceContext } from "@/lib/workspace";

const rolePriority: SchoolRole[] = [...STAFF_ROLES, "student", "guardian"];

async function Workspace({ children }: { children: ReactNode }) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login");

  const topRole = rolePriority.find((role) => context.roles.some((membership) => membership.role === role));
  const roleLabel = context.platformAdmin ? "Platform administrator" : topRole ? ROLE_LABELS[topRole] : "Member";

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
