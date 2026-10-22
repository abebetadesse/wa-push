"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, classrooms, facilities, facilityBookings, facilityItems, facilityLogs, teachers } from "@/db/schema";
import { isDuplicateEntry } from "@/lib/db-errors";
import { formFields } from "@/lib/form-fields";
import { requireSchoolRole } from "@/lib/permissions";
import { FACILITY_COPY, FACILITY_KINDS, ITEM_CATEGORIES, ITEM_CONDITIONS, LOG_TYPES, SEVERITIES } from "./options";

/** Checks the role for the page's kind and returns the parsed fields. */
async function access(formData: FormData) {
  const f = formFields(formData);
  const kind = f.choice("kind", "a facility type", FACILITY_KINDS);
  const schoolId = f.id("schoolId", "a school");
  const { session } = await requireSchoolRole(schoolId, FACILITY_COPY[kind].roles);
  return { f, kind, schoolId, userId: session.user.id, path: FACILITY_COPY[kind].path };
}

/** The ids of this school's rooms of the page's kind, as a subquery for record updates. */
function roomsOfKind(schoolId: string, kind: "lab" | "workshop") {
  return db.select({ id: facilities.id }).from(facilities).where(and(eq(facilities.schoolId, schoolId), eq(facilities.kind, kind)));
}

async function ownFacility(schoolId: string, kind: string, facilityId: string) {
  const [facility] = await db.select({ id: facilities.id, name: facilities.name }).from(facilities)
    .where(and(eq(facilities.id, facilityId), eq(facilities.schoolId, schoolId), eq(facilities.kind, kind as "lab" | "workshop")))
    .limit(1);
  if (!facility) throw new UserError("That room isn't part of this school.");
  return facility;
}

async function addFacilityImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, kind, schoolId, userId, path } = await access(formData);
  const name = f.text("name", "the name", 120);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(facilities).values({
        schoolId,
        kind,
        name,
        location: f.optional("location", "the location", 120),
        capacity: f.optionalInt("capacity", "the capacity", { min: 1, max: 500 }),
      });
      await tx.insert(activityEvents).values({ schoolId, userId, detail: `Added ${FACILITY_COPY[kind].one}: ${name}`.slice(0, 255) });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: `There is already a ${FACILITY_COPY[kind].one} with that name.` };
    throw error;
  }
  revalidatePath(path);
  return { success: `${name} was added.` };
}

async function addItemImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, kind, schoolId, path } = await access(formData);
  const facility = await ownFacility(schoolId, kind, f.id("facilityId", "a room"));
  const name = f.text("name", "the item name", 160);
  await db.insert(facilityItems).values({
    schoolId,
    facilityId: facility.id,
    name,
    category: f.choice("category", "a category", ITEM_CATEGORIES),
    quantity: f.int("quantity", "the quantity", { min: 0, max: 1_000_000 }),
    unit: f.optional("unit", "the unit", 30) ?? "item",
    reorderLevel: f.optionalInt("reorderLevel", "the reorder level", { min: 0, max: 1_000_000 }) ?? 0,
    assetTag: f.optional("assetTag", "the asset tag", 60),
    hazard: f.optional("hazard", "the hazard", 80),
    expiresOn: f.optionalDate("expiresOn", "expiry date"),
  });
  revalidatePath(path);
  return { success: `${name} was added to ${facility.name}.` };
}

async function updateItemImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, kind, schoolId, path } = await access(formData);
  const quantity = f.int("quantity", "the quantity", { min: 0, max: 1_000_000 });
  const condition = f.choice("condition", "a condition", ITEM_CONDITIONS);
  await db.update(facilityItems).set({ quantity, condition })
    .where(and(eq(facilityItems.id, f.id("itemId", "an item")), inArray(facilityItems.facilityId, roomsOfKind(schoolId, kind))));
  revalidatePath(path);
  return {};
}

async function addBookingImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, kind, schoolId, userId, path } = await access(formData);
  const facility = await ownFacility(schoolId, kind, f.id("facilityId", "a room"));
  const date = f.date("date", "date");
  const startTime = f.time("startTime", "start time");
  const endTime = f.time("endTime", "end time");
  if (endTime <= startTime) throw new UserError("The session must end after it starts.");
  const teacherId = f.optionalId("teacherId", "a teacher");
  const classroomId = f.optionalId("classroomId", "a class");
  if (teacherId) {
    const [teacher] = await db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.id, teacherId), eq(teachers.schoolId, schoolId))).limit(1);
    if (!teacher) throw new UserError("That teacher isn't at this school.");
  }
  if (classroomId) {
    const [classroom] = await db.select({ id: classrooms.id }).from(classrooms).where(and(eq(classrooms.id, classroomId), eq(classrooms.schoolId, schoolId))).limit(1);
    if (!classroom) throw new UserError("That class isn't at this school.");
  }
  const purpose = f.text("purpose", "the purpose", 200);

  await db.transaction(async (tx) => {
    // Lock the room so two overlapping bookings can't both pass the check.
    await tx.select({ id: facilities.id }).from(facilities).where(eq(facilities.id, facility.id)).for("update");
    const [clash] = await tx.select({ startTime: facilityBookings.startTime, endTime: facilityBookings.endTime, purpose: facilityBookings.purpose })
      .from(facilityBookings)
      .where(and(
        eq(facilityBookings.facilityId, facility.id),
        eq(facilityBookings.date, date),
        ne(facilityBookings.status, "cancelled"),
        lt(facilityBookings.startTime, endTime),
        gt(facilityBookings.endTime, startTime),
      ))
      .limit(1);
    if (clash) throw new UserError(`${facility.name} is already booked ${clash.startTime}–${clash.endTime} for “${clash.purpose}”.`);
    await tx.insert(facilityBookings).values({ schoolId, facilityId: facility.id, date, startTime, endTime, teacherId, classroomId, purpose, bookedBy: userId });
    await tx.insert(activityEvents).values({ schoolId, userId, detail: `Booked ${facility.name} on ${date} ${startTime}–${endTime}`.slice(0, 255) });
  });
  revalidatePath(path);
  return { success: `${facility.name} booked on ${date}, ${startTime}–${endTime}.` };
}

async function setBookingStatusImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, kind, schoolId, path } = await access(formData);
  const status = f.choice("status", "a status", ["completed", "cancelled"] as const);
  await db.update(facilityBookings).set({ status })
    .where(and(
      eq(facilityBookings.id, f.id("bookingId", "a booking")),
      inArray(facilityBookings.facilityId, roomsOfKind(schoolId, kind)),
      eq(facilityBookings.status, "booked"),
    ));
  revalidatePath(path);
  return {};
}

async function addLogImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, kind, schoolId, userId, path } = await access(formData);
  const facility = await ownFacility(schoolId, kind, f.id("facilityId", "a room"));
  const logType = f.choice("logType", "a type", LOG_TYPES);
  const itemId = f.optionalId("itemId", "an item");
  if (itemId) {
    const [item] = await db.select({ id: facilityItems.id }).from(facilityItems)
      .where(and(eq(facilityItems.id, itemId), eq(facilityItems.facilityId, facility.id))).limit(1);
    if (!item) throw new UserError("That item isn't in this room.");
  }
  const severity = f.choice("severity", "a severity", SEVERITIES);
  await db.transaction(async (tx) => {
    await tx.insert(facilityLogs).values({
      schoolId,
      facilityId: facility.id,
      itemId,
      logType,
      severity,
      occurredOn: f.date("occurredOn", "date"),
      description: f.text("description", "what happened", 1000),
      reportedBy: userId,
    });
    await tx.insert(activityEvents).values({ schoolId, userId, detail: `Logged ${severity} ${logType} in ${facility.name}`.slice(0, 255) });
  });
  revalidatePath(path);
  return { success: `The ${logType} was logged.` };
}

async function resolveLogImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, kind, schoolId, path } = await access(formData);
  const actionTaken = f.text("actionTaken", "what was done", 1000);
  await db.update(facilityLogs).set({ status: "resolved", actionTaken, resolvedAt: new Date() })
    .where(and(eq(facilityLogs.id, f.id("logId", "an entry")), inArray(facilityLogs.facilityId, roomsOfKind(schoolId, kind))));
  revalidatePath(path);
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function addFacility(...args: Parameters<typeof addFacilityImpl>) {
  return guardAction(() => addFacilityImpl(...args));
}
export async function addItem(...args: Parameters<typeof addItemImpl>) {
  return guardAction(() => addItemImpl(...args));
}
export async function updateItem(...args: Parameters<typeof updateItemImpl>) {
  return guardAction(() => updateItemImpl(...args));
}
export async function addBooking(...args: Parameters<typeof addBookingImpl>) {
  return guardAction(() => addBookingImpl(...args));
}
export async function setBookingStatus(...args: Parameters<typeof setBookingStatusImpl>) {
  return guardAction(() => setBookingStatusImpl(...args));
}
export async function addLog(...args: Parameters<typeof addLogImpl>) {
  return guardAction(() => addLogImpl(...args));
}
export async function resolveLog(...args: Parameters<typeof resolveLogImpl>) {
  return guardAction(() => resolveLogImpl(...args));
}
