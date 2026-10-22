"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityEvents, communityEvents, communityPartners, volunteers } from "@/db/schema";
import { isDuplicateEntry } from "@/lib/db-errors";
import { formFields } from "@/lib/form-fields";
import { requireSchoolRole } from "@/lib/permissions";
import { EVENT_TYPES, PARTNER_TYPES } from "./options";

const COMMUNITY_ROLES = ["school_admin", "community_officer"] as const;

async function access(formData: FormData) {
  const f = formFields(formData);
  const schoolId = f.id("schoolId", "a school");
  const { session } = await requireSchoolRole(schoolId, COMMUNITY_ROLES);
  return { f, schoolId, userId: session.user.id };
}

async function ownPartner(schoolId: string, partnerId: string | null) {
  if (!partnerId) return null;
  const [partner] = await db.select({ id: communityPartners.id }).from(communityPartners)
    .where(and(eq(communityPartners.id, partnerId), eq(communityPartners.schoolId, schoolId))).limit(1);
  if (!partner) throw new UserError("That partner isn't recorded at this school.");
  return partner.id;
}

async function addPartnerImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId } = await access(formData);
  const name = f.text("name", "the partner's name", 160);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(communityPartners).values({
        schoolId,
        name,
        partnerType: f.choice("partnerType", "a partner type", PARTNER_TYPES),
        contactName: f.optional("contactName", "the contact name", 120),
        phone: f.optional("phone", "the phone number", 40),
        email: f.email("email", "email address"),
        notes: f.optional("notes", "the notes", 1000),
      });
      await tx.insert(activityEvents).values({ schoolId, userId, detail: `Added community partner: ${name}`.slice(0, 255) });
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { error: "A partner with that name is already recorded." };
    throw error;
  }
  revalidatePath("/community");
  return { success: `${name} was added.` };
}

async function setPartnerStatusImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId } = await access(formData);
  await db.update(communityPartners).set({ status: f.choice("status", "a status", ["active", "inactive"] as const) })
    .where(and(eq(communityPartners.id, f.id("partnerId", "a partner")), eq(communityPartners.schoolId, schoolId)));
  revalidatePath("/community");
  return {};
}

async function addEventImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId } = await access(formData);
  const title = f.text("title", "the title", 200);
  const eventDate = f.date("eventDate", "date");
  await db.transaction(async (tx) => {
    await tx.insert(communityEvents).values({
      schoolId,
      title,
      eventType: f.choice("eventType", "an event type", EVENT_TYPES),
      eventDate,
      startTime: f.raw("startTime") ? f.time("startTime", "start time") : null,
      location: f.optional("location", "the location", 160),
      partnerId: await ownPartner(schoolId, f.optionalId("partnerId", "a partner")),
      description: f.optional("description", "the description", 1000),
      expectedAttendance: f.optionalInt("expectedAttendance", "expected attendance", { min: 0, max: 100_000 }),
      isPublic: formData.get("isPublic") === "on",
      createdBy: userId,
    });
    await tx.insert(activityEvents).values({ schoolId, userId, detail: `Planned community event: ${title} (${eventDate})`.slice(0, 255) });
  });
  revalidatePath("/community");
  return { success: `“${title}” was added to the calendar.` };
}

async function recordEventOutcomeImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId } = await access(formData);
  const eventId = f.id("eventId", "an event");
  const status = f.choice("status", "a status", ["held", "cancelled"] as const);
  const [event] = await db.select({ title: communityEvents.title, status: communityEvents.status }).from(communityEvents)
    .where(and(eq(communityEvents.id, eventId), eq(communityEvents.schoolId, schoolId))).limit(1);
  if (!event) throw new UserError("Event not found.");
  if (event.status !== "planned" && status === "cancelled") throw new UserError("Only a planned event can be cancelled.");
  await db.transaction(async (tx) => {
    await tx.update(communityEvents).set(status === "held"
      ? {
        status,
        actualAttendance: f.optionalInt("actualAttendance", "attendance", { min: 0, max: 100_000 }),
        outcome: f.optional("outcome", "the minutes", 10_000),
      }
      : { status })
      .where(eq(communityEvents.id, eventId));
    await tx.insert(activityEvents).values({ schoolId, userId, detail: `Marked “${event.title}” as ${status}`.slice(0, 255) });
  });
  revalidatePath("/community");
  return { success: status === "held" ? "Outcome saved." : "Event cancelled." };
}

async function setEventPublicImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId } = await access(formData);
  await db.update(communityEvents).set({ isPublic: f.choice("isPublic", "a visibility", ["yes", "no"] as const) === "yes" })
    .where(and(eq(communityEvents.id, f.id("eventId", "an event")), eq(communityEvents.schoolId, schoolId)));
  revalidatePath("/community");
  return {};
}

async function addVolunteerImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId, userId } = await access(formData);
  const name = f.text("name", "the volunteer's name", 160);
  await db.transaction(async (tx) => {
    await tx.insert(volunteers).values({
      schoolId,
      name,
      phone: f.optional("phone", "the phone number", 40),
      email: f.email("email", "email address"),
      skills: f.optional("skills", "the skills", 300),
      availability: f.optional("availability", "the availability", 200),
      partnerId: await ownPartner(schoolId, f.optionalId("partnerId", "a partner")),
    });
    await tx.insert(activityEvents).values({ schoolId, userId, detail: `Registered volunteer: ${name}`.slice(0, 255) });
  });
  revalidatePath("/community");
  return { success: `${name} was registered.` };
}

async function logVolunteerHoursImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { f, schoolId } = await access(formData);
  const hours = f.int("hours", "the hours", { min: 1, max: 200 });
  await db.update(volunteers).set({ hoursContributed: sql`${volunteers.hoursContributed} + ${hours}` })
    .where(and(eq(volunteers.id, f.id("volunteerId", "a volunteer")), eq(volunteers.schoolId, schoolId)));
  revalidatePath("/community");
  return {};
}

// Every action runs through guardAction, so a failure reaches the form as a message instead of
// a blank HTTP 500 (Next.js hides thrown messages in production).
export async function addPartner(...args: Parameters<typeof addPartnerImpl>) {
  return guardAction(() => addPartnerImpl(...args));
}
export async function setPartnerStatus(...args: Parameters<typeof setPartnerStatusImpl>) {
  return guardAction(() => setPartnerStatusImpl(...args));
}
export async function addEvent(...args: Parameters<typeof addEventImpl>) {
  return guardAction(() => addEventImpl(...args));
}
export async function recordEventOutcome(...args: Parameters<typeof recordEventOutcomeImpl>) {
  return guardAction(() => recordEventOutcomeImpl(...args));
}
export async function setEventPublic(...args: Parameters<typeof setEventPublicImpl>) {
  return guardAction(() => setEventPublicImpl(...args));
}
export async function addVolunteer(...args: Parameters<typeof addVolunteerImpl>) {
  return guardAction(() => addVolunteerImpl(...args));
}
export async function logVolunteerHours(...args: Parameters<typeof logVolunteerHoursImpl>) {
  return guardAction(() => logVolunteerHoursImpl(...args));
}
