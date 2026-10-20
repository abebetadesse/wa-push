"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  changeInventoryItemStatus,
  createInventoryItem,
  recordInventoryMovement,
  type InventoryActionState,
} from "./actions";

type SchoolOption = { id: string; name: string };

export function InventoryItemForm({ schools }: { schools: SchoolOption[] }) {
  const [state, action, pending] = useActionState<InventoryActionState, FormData>(createInventoryItem, {});
  return (
    <form action={action} className="auth-form">
      {schools.length > 1
        ? <label>School<select name="schoolId" required>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        : <input name="schoolId" type="hidden" value={schools[0]?.id ?? ""} />}
      <div className="form-two-columns">
        <label>Item name<input maxLength={180} name="name" required /></label>
        <label>SKU <span className="optional-label">Optional</span><input maxLength={80} name="sku" /></label>
        <label>Category <span className="optional-label">Optional</span><input maxLength={100} name="category" /></label>
        <label>Unit<input defaultValue="item" maxLength={40} name="unit" required /></label>
        <label>Reorder level<input defaultValue={0} min={0} max={1000000} name="reorderLevel" required type="number" /></label>
        <label>Storage location <span className="optional-label">Optional</span><input maxLength={120} name="location" /></label>
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-success" role="status">{state.success}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Adding item..." : "Add inventory item"}</button>
    </form>
  );
}

export function StockMovementForm({
  schoolId,
  itemId,
}: {
  schoolId: string;
  itemId: string;
}) {
  const [state, action, pending] = useActionState<InventoryActionState, FormData>(recordInventoryMovement, {});
  return (
    <form action={action} className="stock-movement-form">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="itemId" type="hidden" value={itemId} />
      <label><span className="visually-hidden">Movement type</span>
        <select aria-label="Movement type" name="movementType" defaultValue="received">
          <option value="received">Receive</option>
          <option value="issued">Issue</option>
        </select>
      </label>
      <label><span className="visually-hidden">Quantity</span><input aria-label="Quantity" name="quantity" min={1} max={1000000} placeholder="Qty" required type="number" /></label>
      <label className="stock-reason"><span className="visually-hidden">Reason</span><input aria-label="Reason" maxLength={255} name="reason" placeholder="Reason" required /></label>
      <button className="secondary-button" disabled={pending} type="submit">{pending ? "Saving..." : "Record"}</button>
      {(state.error || state.success) && <span className={state.error ? "result-message result-error" : "result-message"} role={state.error ? "alert" : "status"}>{state.error ?? state.success}</span>}
    </form>
  );
}

export function InventoryItemStatusForm({
  schoolId,
  itemId,
  active,
}: {
  schoolId: string;
  itemId: string;
  active: boolean;
}) {
  return (
    <form action={changeInventoryItemStatus}>
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="itemId" type="hidden" value={itemId} />
      <input name="status" type="hidden" value={active ? "inactive" : "active"} />
      <SubmitButton pendingLabel={active ? "Deactivating…" : "Activating…"}>{active ? "Deactivate" : "Activate"}</SubmitButton>
    </form>
  );
}
