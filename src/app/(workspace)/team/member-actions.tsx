"use client";

import type { FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { changeMemberRole, removeMember, revokeInvitation } from "./actions";

const roleLabels = {
  school_admin: "School administrator",
  teacher: "Teacher",
  inventory_manager: "Inventory manager",
  hr_manager: "Human resources manager",
} as const;

function confirmSubmit(message: string) {
  return (event: FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
}

export function MemberActions({
  schoolId,
  userId,
  name,
  role,
  allowSchoolAdmin,
}: {
  schoolId: string;
  userId: string;
  name: string;
  role: string;
  allowSchoolAdmin: boolean;
}) {
  const isStaff = role in roleLabels;
  return (
    <>
      {isStaff && <form action={changeMemberRole} className="stock-movement-form">
        <input name="schoolId" type="hidden" value={schoolId} />
        <input name="userId" type="hidden" value={userId} />
        <label><span className="visually-hidden">Role for {name}</span>
          <select aria-label={`Role for ${name}`} defaultValue={role} name="role">
            {Object.entries(roleLabels)
              .filter(([value]) => allowSchoolAdmin || value !== "school_admin")
              .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <SubmitButton pendingLabel="Saving…">Change role</SubmitButton>
      </form>}
      <form action={removeMember} onSubmit={confirmSubmit(`Remove ${name} from this school? They will lose access immediately.`)}>
        <input name="schoolId" type="hidden" value={schoolId} />
        <input name="userId" type="hidden" value={userId} />
        <SubmitButton pendingLabel="Removing…">Remove</SubmitButton>
      </form>
    </>
  );
}

export function RevokeInvitationButton({
  schoolId,
  invitationId,
  email,
}: {
  schoolId: string;
  invitationId: string;
  email: string;
}) {
  return (
    <form action={revokeInvitation} onSubmit={confirmSubmit(`Revoke the invitation for ${email}? The emailed link will stop working.`)}>
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="invitationId" type="hidden" value={invitationId} />
      <SubmitButton pendingLabel="Revoking…">Revoke</SubmitButton>
    </form>
  );
}
