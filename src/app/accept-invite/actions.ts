"use server";

import { revalidatePath } from "next/cache";
import { acceptInvitation, findPendingInvitation } from "@/lib/invitations";
import { getSession } from "@/lib/permissions";

export async function acceptInvitationForCurrentUser(token: string) {
  const session = await getSession();
  if (!session) return { error: "Sign in to accept this invitation." };

  const invitation = await findPendingInvitation(token, session.user.email);
  if (!invitation) return { error: "This invitation is invalid, expired, or belongs to another email address." };

  await acceptInvitation(token, session.user.email, session.user.id);
  revalidatePath("/");
  return { success: true as const };
}
