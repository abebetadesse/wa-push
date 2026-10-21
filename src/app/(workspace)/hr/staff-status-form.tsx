import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { changeStaffStatus } from "./actions";

export function StaffStatusForm({
  schoolId,
  staffId,
  status,
}: {
  schoolId: string;
  staffId: string;
  status: "active" | "on_leave" | "inactive";
}) {
  const nextStatus = status === "active" ? "on_leave" : "active";
  return (
    <ActionForm action={changeStaffStatus} className="staff-status-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="staffId" type="hidden" value={staffId} />
      <input name="status" type="hidden" value={nextStatus} />
      <SubmitButton pendingLabel="Saving…">{status === "active" ? "Set on leave" : status === "on_leave" ? "Return to active" : "Reactivate"}</SubmitButton>
    </ActionForm>
  );
}
