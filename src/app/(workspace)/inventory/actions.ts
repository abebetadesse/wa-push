"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, inventoryItems, inventoryMovements } from "@/db/schema";
import { requireSchoolRole } from "@/lib/permissions";
import { isDuplicateEntry } from "@/lib/db-errors";

export type InventoryActionState = { error?: string; success?: string };

async function createInventoryItemImpl(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const rawReorderLevel = String(formData.get("reorderLevel") ?? "").trim();
  const reorderLevel = Number(rawReorderLevel);
  if (!schoolId || !name || name.length > 180 || !unit || unit.length > 40) {
    return { error: "Enter an item name and unit within the allowed length." };
  }
  if (sku.length > 80 || category.length > 100 || location.length > 120) {
    return { error: "SKU, category, or location is longer than the allowed limit." };
  }
  if (!Number.isInteger(reorderLevel) || reorderLevel < 0 || reorderLevel > 1_000_000) {
    return { error: "Set a non-negative whole-number reorder level." };
  }

  const { session } = await requireSchoolRole(schoolId, ["school_admin", "inventory_manager"]);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(inventoryItems).values({
        id: randomUUID(),
        schoolId,
        name,
        sku: sku || null,
        category: category || null,
        unit,
        location: location || null,
        reorderLevel,
      });
      await tx.insert(activityEvents).values({
        schoolId,
        userId: session.user.id,
        detail: `Added inventory item: ${name}`,
      });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "That SKU is already in use at this school." };
    throw error;
  }
  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: `${name} was added to inventory.` };
}

async function recordInventoryMovementImpl(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const movementType = String(formData.get("movementType") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const rawQuantity = String(formData.get("quantity") ?? "").trim();
  const quantity = Number(rawQuantity);
  if (!schoolId || !itemId || (movementType !== "received" && movementType !== "issued")) {
    return { error: "Choose an item and valid stock movement." };
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
    return { error: "Quantity must be a whole number between 1 and 1,000,000." };
  }
  if (!reason || reason.length > 255) return { error: "Enter a reason of 255 characters or fewer." };
  const { session } = await requireSchoolRole(schoolId, ["school_admin", "inventory_manager"]);

  const result = await db.transaction(async (tx) => {
    const delta = movementType === "received" ? quantity : -quantity;
    const [lockedItem] = await tx.select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      quantityOnHand: inventoryItems.quantityOnHand,
      status: inventoryItems.status,
    }).from(inventoryItems)
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.schoolId, schoolId)))
      .limit(1)
      .for("update");
    if (!lockedItem || lockedItem.status !== "active") return { error: "The selected inventory item is unavailable." };
    if (lockedItem.quantityOnHand + delta < 0) {
      return { error: `Only ${lockedItem.quantityOnHand} units are currently available.` };
    }
    await tx.update(inventoryItems)
      .set({ quantityOnHand: sql`${inventoryItems.quantityOnHand} + ${delta}` })
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.schoolId, schoolId)));
    await tx.insert(inventoryMovements).values({
      id: randomUUID(),
      schoolId,
      itemId,
      movementType,
      quantity,
      reason,
      recordedBy: session.user.id,
    });
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `${movementType === "received" ? "Received" : "Issued"} ${quantity} ${lockedItem.name}`,
    });
    return { success: true };
  });
  if ("error" in result) return { error: result.error };
  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: "Stock movement recorded." };
}

async function changeInventoryItemStatusImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!schoolId || !itemId || (status !== "active" && status !== "inactive")) {
    throw new UserError("Invalid inventory status update.");
  }
  const { session } = await requireSchoolRole(schoolId, ["school_admin", "inventory_manager"]);
  const [item] = await db.select({ name: inventoryItems.name })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.schoolId, schoolId)))
    .limit(1);
  if (!item) throw new UserError("Inventory item not found in this school.");
  await db.transaction(async (tx) => {
    await tx.update(inventoryItems)
      .set({ status })
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.schoolId, schoolId)));
    await tx.insert(activityEvents).values({
      schoolId,
      userId: session.user.id,
      detail: `${status === "active" ? "Activated" : "Deactivated"} inventory item: ${item.name}`,
    });
  });
  revalidatePath("/inventory");
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function createInventoryItem(...args: Parameters<typeof createInventoryItemImpl>) {
  return guardAction(() => createInventoryItemImpl(...args));
}
export async function recordInventoryMovement(...args: Parameters<typeof recordInventoryMovementImpl>) {
  return guardAction(() => recordInventoryMovementImpl(...args));
}
export async function changeInventoryItemStatus(...args: Parameters<typeof changeInventoryItemStatusImpl>) {
  return guardAction(() => changeInventoryItemStatusImpl(...args));
}
