import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { authUsers, inventoryItems, inventoryMovements, schools } from "@/db/schema";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { InventoryItemForm, InventoryItemStatusForm, StockMovementForm } from "./forms";

export const metadata: Metadata = { title: "Inventory | Forma" };

async function InventoryContent() {
  const { schoolIds, schools: visibleSchools } = await requireSchoolsFor(pageRoles.inventory);
  const [itemRows, movements] = await Promise.all([
    db.select({
      id: inventoryItems.id,
      schoolId: inventoryItems.schoolId,
      schoolName: schools.name,
      name: inventoryItems.name,
      sku: inventoryItems.sku,
      category: inventoryItems.category,
      unit: inventoryItems.unit,
      quantityOnHand: inventoryItems.quantityOnHand,
      reorderLevel: inventoryItems.reorderLevel,
      location: inventoryItems.location,
      status: inventoryItems.status,
    }).from(inventoryItems)
      .innerJoin(schools, eq(inventoryItems.schoolId, schools.id))
      .where(inArray(inventoryItems.schoolId, schoolIds))
      .orderBy(schools.name, inventoryItems.name),
    db.select({
      id: inventoryMovements.id,
      schoolId: inventoryMovements.schoolId,
      schoolName: schools.name,
      itemName: inventoryItems.name,
      movementType: inventoryMovements.movementType,
      quantity: inventoryMovements.quantity,
      reason: inventoryMovements.reason,
      createdAt: inventoryMovements.createdAt,
      recordedBy: authUsers.name,
    }).from(inventoryMovements)
      .innerJoin(schools, eq(inventoryMovements.schoolId, schools.id))
      .innerJoin(inventoryItems, eq(inventoryMovements.itemId, inventoryItems.id))
      .innerJoin(authUsers, eq(inventoryMovements.recordedBy, authUsers.id))
      .where(inArray(inventoryMovements.schoolId, schoolIds))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(50),
  ]);
  const lowStockCount = itemRows.filter((item) => item.status === "active" && item.quantityOnHand <= item.reorderLevel).length;

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">SCHOOL OPERATIONS</p>
          <h1>Inventory</h1>
          <p className="management-description">{itemRows.length} tracked items · {lowStockCount} at or below reorder level.</p>
        </div>
      </header>
      <div className="management-sections">
        <section className="management-card">
          <h2>Add an inventory item</h2>
          <p className="assessment-help">Initial quantities are recorded as stock receipts to keep an auditable movement history.</p>
          <InventoryItemForm schools={visibleSchools} />
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Stock register</h2><p>Receive or issue stock; issues cannot make stock negative.</p></div></div>
          {itemRows.length === 0
            ? <p className="empty-state">No inventory items have been registered yet.</p>
            : <div className="inventory-list">{itemRows.map((item) => (
              <article className="inventory-item" key={item.id}>
                <div className="inventory-item-heading">
                  <div><h3>{item.name}</h3><p>{item.schoolName} · {item.sku || "No SKU"}{item.category ? ` · ${item.category}` : ""}{item.location ? ` · ${item.location}` : ""}</p></div>
                  <span className={`role-badge ${item.status === "active" ? (item.quantityOnHand <= item.reorderLevel ? "status-submitted" : "status-published") : "status-inactive"}`}>
                    {item.status === "inactive" ? "Inactive" : item.quantityOnHand <= item.reorderLevel ? "Reorder" : "In stock"}
                  </span>
                </div>
                <p className="inventory-quantity"><strong>{item.quantityOnHand}</strong> {item.unit} on hand <span>Reorder at {item.reorderLevel}</span></p>
                {item.status === "active" && <StockMovementForm schoolId={item.schoolId} itemId={item.id} />}
                <InventoryItemStatusForm schoolId={item.schoolId} itemId={item.id} active={item.status === "active"} />
              </article>
            ))}</div>}
        </section>
        <section className="management-card">
          <div className="management-card-heading"><div><h2>Recent stock movements</h2><p>Latest 50 receipts and issues across your authorized schools</p></div></div>
          {movements.length === 0
            ? <p className="empty-state">No stock movements recorded yet.</p>
            : <div className="record-list">{movements.map((movement) => (
              <div className="record-row" key={movement.id}>
                <div><strong>{movement.itemName} · {movement.movementType === "received" ? "Received" : "Issued"} {movement.quantity}</strong>
                  <small>{movement.schoolName} · {movement.reason} · {movement.recordedBy} · {movement.createdAt.toLocaleString()}</small></div>
              </div>
            ))}</div>}
        </section>
      </div>
    </main>
  );
}

export default function InventoryPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading inventory...</p></main>}><InventoryContent /></Suspense>;
}
