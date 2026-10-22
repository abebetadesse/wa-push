"use client";

import { ActionForm } from "@/components/action-form";
import type { FormEvent } from "react";
import { SubmitButton } from "@/components/submit-button";
import { isStaffRole, ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import { changeMemberRole, removeMember, revokeInvitation } from "./actions";


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
  const isStaff = isStaffRole(role);
  return (
    <>
      {isStaff && <ActionForm action={changeMemberRole} className="stock-movement-form">
        <input name="schoolId" type="hidden" value={schoolId} />
        <input name="userId" type="hidden" value={userId} />
        <label><span className="visually-hidden">Role for {name}</span>
          <select aria-label={`Role for ${name}`} defaultValue={role} name="role">
            {STAFF_ROLES
              .filter((value) => allowSchoolAdmin || value !== "school_admin")
              .map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
          </select>
        </label>
        <SubmitButton pendingLabel="Saving…">Change role</SubmitButton>
      </ActionForm>}
      <ActionForm action={removeMember} onSubmit={confirmSubmit(`Remove ${name} from this school? They will lose access immediately.`)}>
        <input name="schoolId" type="hidden" value={schoolId} />
        <input name="userId" type="hidden" value={userId} />
        <SubmitButton pendingLabel="Removing…">Remove</SubmitButton>
      </ActionForm>
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
    <ActionForm action={revokeInvitation} onSubmit={confirmSubmit(`Revoke the invitation for ${email}? The emailed link will stop working.`)}>
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="invitationId" type="hidden" value={invitationId} />
      <SubmitButton pendingLabel="Revoking…">Revoke</SubmitButton>
    </ActionForm>
  );
}
