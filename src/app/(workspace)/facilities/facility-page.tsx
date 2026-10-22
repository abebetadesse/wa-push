import { and, asc, desc, eq, gte } from "drizzle-orm";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RecordForm, RowButton } from "@/components/record-form";
import { SchoolPicker, selectedSchool } from "@/components/school-picker";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { academicYears, classrooms, facilities, facilityBookings, facilityItems, facilityLogs, teachers } from "@/db/schema";
import { addDays, enumOptions, humanize } from "@/lib/format";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { addBooking, addFacility, addItem, addLog, resolveLog, setBookingStatus, updateItem } from "./actions";
import { FACILITY_COPY, ITEM_CATEGORIES, ITEM_CONDITIONS, LOG_TYPES, SEVERITIES, type FacilityKind } from "./options";

const TABS = ["rooms", "inventory", "bookings", "log"] as const;
export type FacilitySearchParams = Promise<{ schoolId?: string; tab?: string }>;

export async function FacilityContent({ kind, searchParams }: { kind: FacilityKind; searchParams: FacilitySearchParams }) {
  const copy = FACILITY_COPY[kind];
  const { schoolIds, schools: visibleSchools } = await requireSchoolsFor(kind === "lab" ? pageRoles.lab : pageRoles.workshop);
  const params = await searchParams;
  const schoolId = selectedSchool(params.schoolId, schoolIds);
  const tab = activeTab(params.tab, TABS);
  const today = new Date().toISOString().slice(0, 10);
  const soon = addDays(today, 30);

  const rooms = await db.select().from(facilities).where(and(eq(facilities.schoolId, schoolId), eq(facilities.kind, kind))).orderBy(facilities.name);
  const roomIds = new Set(rooms.map((room) => room.id));
  const roomName = new Map(rooms.map((room) => [room.id, room.name]));
  const [items, bookings, logs, teacherRows, classRows] = await Promise.all([
    db.select().from(facilityItems).where(eq(facilityItems.schoolId, schoolId)).orderBy(asc(facilityItems.name)),
    db.select().from(facilityBookings).where(and(eq(facilityBookings.schoolId, schoolId), gte(facilityBookings.date, addDays(today, -7))))
      .orderBy(asc(facilityBookings.date), asc(facilityBookings.startTime)),
    db.select().from(facilityLogs).where(eq(facilityLogs.schoolId, schoolId)).orderBy(desc(facilityLogs.occurredOn)).limit(200),
    db.select({ id: teachers.id, firstName: teachers.firstName, lastName: teachers.lastName }).from(teachers)
      .where(and(eq(teachers.schoolId, schoolId), eq(teachers.status, "active"))).orderBy(teachers.lastName),
    db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms)
      .innerJoin(academicYears, and(eq(academicYears.id, classrooms.academicYearId), eq(academicYears.isCurrent, true)))
      .where(eq(classrooms.schoolId, schoolId)).orderBy(classrooms.name),
  ]);
  // The tables hold labs and workshops together; keep this page's kind.
  const roomItems = items.filter((item) => roomIds.has(item.facilityId));
  const roomBookings = bookings.filter((booking) => roomIds.has(booking.facilityId));
  const roomLogs = logs.filter((log) => roomIds.has(log.facilityId));
  const teacherName = new Map(teacherRows.map((teacher) => [teacher.id, `${teacher.firstName} ${teacher.lastName}`]));
  const className = new Map(classRows.map((classroom) => [classroom.id, classroom.name]));

  const lowStock = roomItems.filter((item) => item.reorderLevel > 0 && item.quantity <= item.reorderLevel);
  const expiring = roomItems.filter((item) => item.expiresOn && item.expiresOn <= soon);
  const broken = roomItems.filter((item) => item.condition !== "good");
  const openLogs = roomLogs.filter((log) => log.status === "open");
  const upcoming = roomBookings.filter((booking) => booking.status === "booked" && booking.date >= today);
  const roomOptions = rooms.map((room) => ({ value: room.id, label: room.name }));
  const hidden = { schoolId, kind };

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">SCHOOL OPERATIONS</p>
          <h1>{copy.title}</h1>
          <p className="management-description">{copy.description}</p>
        </div>
      </header>
      <SchoolPicker basePath={copy.path} keep={{ tab }} schools={visibleSchools} selected={schoolId} />
      <div className="textbook-summary">
        <div><strong>{rooms.length}</strong><span>{copy.one}{rooms.length === 1 ? "" : "s"}</span></div>
        <div><strong>{upcoming.length}</strong><span>upcoming bookings</span></div>
        <div><strong>{lowStock.length + expiring.length + broken.length}</strong><span>items needing attention</span></div>
        <div><strong>{openLogs.length}</strong><span>open {kind === "lab" ? "incidents" : "issues"}</span></div>
      </div>
      <PageTabs active={tab} basePath={copy.path} params={{ schoolId }} tabs={[
        { id: "rooms", label: kind === "lab" ? "Laboratories" : "Workshops", count: rooms.length },
        { id: "inventory", label: "Inventory" },
        { id: "bookings", label: "Bookings", count: upcoming.length || undefined },
        { id: "log", label: kind === "lab" ? "Safety log" : "Maintenance log", count: openLogs.length || undefined },
      ]} />
      <div className="management-sections">
        {tab === "rooms" && <>
          <section className="management-card">
            <h2>Add a {copy.one}</h2>
            <RecordForm action={addFacility} hidden={hidden} submitLabel={`Add ${copy.one}`} fields={[
              { name: "name", label: "Name", required: true, max: 120, placeholder: kind === "lab" ? "Chemistry laboratory" : "Woodwork workshop" },
              { name: "location", label: "Location", max: 120, placeholder: "Block B, ground floor" },
              { name: "capacity", label: "Students it holds", type: "number", min: 1, max: 500 },
            ]} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>{copy.title}</h2><p>{rooms.length} at this school</p></div></div>
            {rooms.length === 0 ? <p className="empty-state">No {copy.one}s yet. Add one above to start recording its inventory and bookings.</p> : <div className="record-list">{rooms.map((room) => {
              const roomStock = roomItems.filter((item) => item.facilityId === room.id);
              return (
                <div className="record-row" key={room.id}>
                  <div><strong>{room.name}</strong>
                    <small>{[room.location, room.capacity && `${room.capacity} students`, `${roomStock.length} item types`, `${upcoming.filter((booking) => booking.facilityId === room.id).length} upcoming bookings`].filter(Boolean).join(" · ")}</small></div>
                </div>
              );
            })}</div>}
          </section>
        </>}

        {tab === "inventory" && <>
          {(lowStock.length > 0 || expiring.length > 0 || broken.length > 0) && (
            <section className="management-card">
              <h2>Needs attention</h2>
              <ul className="material-list">
                {lowStock.map((item) => <li key={`low-${item.id}`}>{item.name} ({roomName.get(item.facilityId)}): {item.quantity} {item.unit} left, reorder at {item.reorderLevel}</li>)}
                {expiring.map((item) => <li key={`exp-${item.id}`}>{item.name} ({roomName.get(item.facilityId)}): {item.expiresOn! < today ? "expired" : "expires"} {item.expiresOn}</li>)}
                {broken.map((item) => <li key={`bad-${item.id}`}>{item.name} ({roomName.get(item.facilityId)}): {humanize(item.condition).toLowerCase()}</li>)}
              </ul>
            </section>
          )}
          <section className="management-card">
            <h2>Add an item</h2>
            {rooms.length === 0 ? <p className="empty-state">Add a {copy.one} first.</p> : <RecordForm action={addItem} hidden={hidden} submitLabel="Add item" fields={[
              { name: "facilityId", label: kind === "lab" ? "Laboratory" : "Workshop", type: "select", required: true, options: roomOptions, defaultValue: rooms.length === 1 ? rooms[0].id : undefined },
              { name: "name", label: "Item", required: true, max: 160, placeholder: kind === "lab" ? "Hydrochloric acid 1M" : "Hand saw" },
              { name: "category", label: "Category", type: "select", required: true, options: enumOptions(ITEM_CATEGORIES), defaultValue: kind === "lab" ? "equipment" : "tool" },
              { name: "quantity", label: "Quantity", type: "number", required: true, min: 0, defaultValue: "1" },
              { name: "unit", label: "Unit", max: 30, placeholder: "item, bottle, litre, kg" },
              { name: "reorderLevel", label: "Reorder at", type: "number", min: 0 },
              { name: "assetTag", label: "Asset tag", max: 60 },
              { name: "hazard", label: "Hazard", max: 80, placeholder: kind === "lab" ? "Corrosive, flammable…" : "Sharp, electrical…" },
              { name: "expiresOn", label: "Expiry date", type: "date" },
            ]} />}
          </section>
          {rooms.map((room) => {
            const roomStock = roomItems.filter((item) => item.facilityId === room.id);
            return (
              <section className="management-card" key={room.id}>
                <div className="management-card-heading"><div><h2>{room.name}</h2><p>{roomStock.length} item type{roomStock.length === 1 ? "" : "s"}</p></div></div>
                {roomStock.length === 0 ? <p className="empty-state">No items recorded.</p> : <div className="record-list">{roomStock.map((item) => (
                  <div className="record-row" key={item.id}>
                    <div><strong>{item.name}</strong>
                      <small>{[humanize(item.category), item.assetTag && `Tag ${item.assetTag}`, item.hazard && `⚠ ${item.hazard}`, item.expiresOn && `Expires ${item.expiresOn}`].filter(Boolean).join(" · ")}</small></div>
                    <ActionForm action={updateItem} className="inline-actions">
                      <input name="schoolId" type="hidden" value={schoolId} />
                      <input name="kind" type="hidden" value={kind} />
                      <input name="itemId" type="hidden" value={item.id} />
                      <input aria-label={`Quantity of ${item.name}`} className="number-input" defaultValue={item.quantity} min={0} name="quantity" type="number" />
                      <span>{item.unit}</span>
                      <select aria-label={`Condition of ${item.name}`} defaultValue={item.condition} name="condition">
                        {ITEM_CONDITIONS.map((condition) => <option key={condition} value={condition}>{humanize(condition)}</option>)}
                      </select>
                      <SubmitButton pendingLabel="Saving…">Update</SubmitButton>
                    </ActionForm>
                  </div>
                ))}</div>}
              </section>
            );
          })}
        </>}

        {tab === "bookings" && <>
          <section className="management-card">
            <h2>Book a session</h2>
            {rooms.length === 0 ? <p className="empty-state">Add a {copy.one} first.</p> : <RecordForm action={addBooking} hidden={hidden} submitLabel="Book" fields={[
              { name: "facilityId", label: kind === "lab" ? "Laboratory" : "Workshop", type: "select", required: true, options: roomOptions, defaultValue: rooms.length === 1 ? rooms[0].id : undefined },
              { name: "date", label: "Date", type: "date", required: true, defaultValue: today },
              { name: "startTime", label: "Starts", type: "time", required: true },
              { name: "endTime", label: "Ends", type: "time", required: true },
              { name: "teacherId", label: "Teacher", type: "select", options: teacherRows.map((teacher) => ({ value: teacher.id, label: `${teacher.firstName} ${teacher.lastName}` })) },
              { name: "classroomId", label: "Class", type: "select", options: classRows.map((classroom) => ({ value: classroom.id, label: classroom.name })) },
              { name: "purpose", label: kind === "lab" ? "Practical / experiment" : "Practical session", required: true, max: 200, wide: true },
            ]} />}
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Bookings</h2><p>From one week ago onwards</p></div></div>
            {roomBookings.length === 0 ? <p className="empty-state">No bookings.</p> : <div className="record-list">{roomBookings.map((booking) => (
              <div className="record-row" key={booking.id}>
                <div><strong>{booking.date} · {booking.startTime}–{booking.endTime} · {roomName.get(booking.facilityId)}</strong>
                  <small>{[booking.purpose, booking.teacherId && teacherName.get(booking.teacherId), booking.classroomId && className.get(booking.classroomId)].filter(Boolean).join(" · ")}</small></div>
                <span className={`role-badge status-${booking.status === "cancelled" ? "inactive" : "active"}`}>{booking.status}</span>
                {booking.status === "booked" && <span className="inline-actions">
                  <RowButton action={setBookingStatus} hidden={{ ...hidden, bookingId: booking.id, status: "completed" }} label="Held" />
                  <RowButton action={setBookingStatus} confirm="Cancel this booking?" hidden={{ ...hidden, bookingId: booking.id, status: "cancelled" }} label="Cancel" />
                </span>}
              </div>
            ))}</div>}
          </section>
        </>}

        {tab === "log" && <>
          <section className="management-card">
            <h2>{kind === "lab" ? "Report an incident or maintenance" : "Log maintenance or an incident"}</h2>
            {rooms.length === 0 ? <p className="empty-state">Add a {copy.one} first.</p> : <RecordForm action={addLog} hidden={hidden} submitLabel="Log it" fields={[
              { name: "facilityId", label: kind === "lab" ? "Laboratory" : "Workshop", type: "select", required: true, options: roomOptions, defaultValue: rooms.length === 1 ? rooms[0].id : undefined },
              { name: "logType", label: "Type", type: "select", required: true, options: enumOptions(LOG_TYPES), defaultValue: kind === "lab" ? "incident" : "maintenance" },
              { name: "severity", label: "Severity", type: "select", required: true, options: enumOptions(SEVERITIES), defaultValue: "low" },
              { name: "occurredOn", label: "Date", type: "date", required: true, defaultValue: today },
              { name: "itemId", label: "Item involved", type: "select", options: roomItems.map((item) => ({ value: item.id, label: `${item.name} (${roomName.get(item.facilityId)})` })), wide: true },
              { name: "description", label: "What happened", type: "textarea", required: true, max: 1000 },
            ]} />}
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>{kind === "lab" ? "Safety log" : "Maintenance log"}</h2><p>{openLogs.length} open</p></div></div>
            {roomLogs.length === 0 ? <p className="empty-state">Nothing logged.</p> : <div className="record-list">{roomLogs.map((log) => (
              <div className="record-row" key={log.id}>
                <div><strong>{log.occurredOn} · {humanize(log.logType)} · {roomName.get(log.facilityId)}</strong>
                  <small className="material-text">{log.description}{log.itemId ? ` · ${roomItems.find((item) => item.id === log.itemId)?.name ?? ""}` : ""}{log.actionTaken ? `\nAction: ${log.actionTaken}` : ""}</small></div>
                <span className={`role-badge status-${log.status === "resolved" ? "active" : log.severity === "high" ? "inactive" : "on_leave"}`}>{log.status === "resolved" ? "resolved" : `${log.severity} · open`}</span>
                {log.status === "open" && (
                  <ActionForm action={resolveLog} className="inline-actions">
                    <input name="schoolId" type="hidden" value={schoolId} />
                    <input name="kind" type="hidden" value={kind} />
                    <input name="logId" type="hidden" value={log.id} />
                    <input aria-label="Action taken" maxLength={1000} name="actionTaken" placeholder="Action taken" required />
                    <SubmitButton pendingLabel="Saving…">Resolve</SubmitButton>
                  </ActionForm>
                )}
              </div>
            ))}</div>}
          </section>
        </>}
      </div>
    </main>
  );
}
