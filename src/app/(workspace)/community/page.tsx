import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { RecordForm, RowButton } from "@/components/record-form";
import { SchoolPicker, selectedSchool } from "@/components/school-picker";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/db";
import { communityEvents, communityPartners, volunteers } from "@/db/schema";
import { enumOptions, humanize } from "@/lib/format";
import { pageRoles, requireSchoolsFor } from "@/lib/workspace";
import { addEvent, addPartner, addVolunteer, logVolunteerHours, recordEventOutcome, setEventPublic, setPartnerStatus } from "./actions";
import { EVENT_TYPES, PARTNER_TYPES } from "./options";

export const metadata: Metadata = { title: "Community | Forma" };

const TABS = ["events", "partners", "volunteers"] as const;
type SearchParams = Promise<{ schoolId?: string; tab?: string }>;

async function CommunityContent({ searchParams }: { searchParams: SearchParams }) {
  const { schoolIds, schools: visibleSchools } = await requireSchoolsFor(pageRoles.community);
  const params = await searchParams;
  const schoolId = selectedSchool(params.schoolId, schoolIds);
  const tab = activeTab(params.tab, TABS);
  const today = new Date().toISOString().slice(0, 10);

  const [partners, events, people] = await Promise.all([
    db.select().from(communityPartners).where(eq(communityPartners.schoolId, schoolId)).orderBy(asc(communityPartners.name)),
    db.select().from(communityEvents).where(eq(communityEvents.schoolId, schoolId)).orderBy(desc(communityEvents.eventDate)).limit(300),
    db.select().from(volunteers).where(eq(volunteers.schoolId, schoolId)).orderBy(asc(volunteers.name)),
  ]);
  const partnerName = new Map(partners.map((partner) => [partner.id, partner.name]));
  const partnerOptions = partners.filter((partner) => partner.status === "active").map((partner) => ({ value: partner.id, label: partner.name }));
  const planned = events.filter((event) => event.status === "planned").sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const past = events.filter((event) => event.status !== "planned");
  const totalAttendance = events.reduce((sum, event) => sum + (event.actualAttendance ?? 0), 0);
  const totalHours = people.reduce((sum, person) => sum + person.hoursContributed, 0);

  return (
    <main className="management-page">
      <header className="management-header">
        <div>
          <Link href="/" className="management-back">← Dashboard</Link>
          <p className="auth-eyebrow">ENGAGEMENT</p>
          <h1>Community</h1>
          <p className="management-description">Parent meetings, PTSA, partners, community events and volunteers, with the outcome of each meeting.</p>
        </div>
      </header>
      <SchoolPicker basePath="/community" keep={{ tab }} schools={visibleSchools} selected={schoolId} />
      <div className="textbook-summary">
        <div><strong>{planned.length}</strong><span>planned events</span></div>
        <div><strong>{totalAttendance}</strong><span>people attended past events</span></div>
        <div><strong>{partners.filter((partner) => partner.status === "active").length}</strong><span>active partners</span></div>
        <div><strong>{totalHours}</strong><span>volunteer hours</span></div>
      </div>
      <PageTabs active={tab} basePath="/community" params={{ schoolId }} tabs={[
        { id: "events", label: "Events & meetings", count: planned.length || undefined },
        { id: "partners", label: "Partners", count: partners.length },
        { id: "volunteers", label: "Volunteers", count: people.length },
      ]} />
      <div className="management-sections">
        {tab === "events" && <>
          <section className="management-card">
            <h2>Plan an event or meeting</h2>
            <RecordForm action={addEvent} hidden={{ schoolId }} submitLabel="Add to calendar" fields={[
              { name: "title", label: "Title", required: true, max: 200, wide: true, placeholder: "Term 1 parents' meeting" },
              { name: "eventType", label: "Type", type: "select", required: true, options: enumOptions(EVENT_TYPES) },
              { name: "eventDate", label: "Date", type: "date", required: true, defaultValue: today },
              { name: "startTime", label: "Starts", type: "time" },
              { name: "location", label: "Location", max: 160 },
              { name: "partnerId", label: "With partner", type: "select", options: partnerOptions },
              { name: "expectedAttendance", label: "Expected attendance", type: "number", min: 0 },
              { name: "description", label: "Agenda / description", type: "textarea", max: 1000 },
              { name: "isPublic", label: "Show on the school's public page", type: "checkbox" },
            ]} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Planned</h2><p>{planned.length} upcoming or awaiting an outcome</p></div></div>
            {planned.length === 0 ? <p className="empty-state">Nothing planned.</p> : <div className="record-list">{planned.map((event) => (
              <div className="record-row community-event" key={event.id}>
                <div><strong>{event.eventDate}{event.startTime ? ` ${event.startTime}` : ""} · {event.title}</strong>
                  <small>{[humanize(event.eventType), event.location, event.partnerId && partnerName.get(event.partnerId), event.expectedAttendance && `${event.expectedAttendance} expected`, event.isPublic && "public"].filter(Boolean).join(" · ")}</small>
                  {event.description && <small className="material-text">{event.description}</small>}
                </div>
                <span className="inline-actions">
                  <RowButton action={setEventPublic} hidden={{ schoolId, eventId: event.id, isPublic: event.isPublic ? "no" : "yes" }} label={event.isPublic ? "Make private" : "Make public"} />
                  <RowButton action={recordEventOutcome} confirm="Cancel this event?" hidden={{ schoolId, eventId: event.id, status: "cancelled" }} label="Cancel" />
                </span>
                {event.eventDate <= today && (
                  <ActionForm action={recordEventOutcome} className="auth-form outcome-form">
                    <input name="schoolId" type="hidden" value={schoolId} />
                    <input name="eventId" type="hidden" value={event.id} />
                    <input name="status" type="hidden" value="held" />
                    <label>Attended<input className="number-input" min={0} name="actualAttendance" type="number" /></label>
                    <label>Minutes and outcomes<textarea maxLength={10000} name="outcome" rows={3} /></label>
                    <SubmitButton pendingLabel="Saving…">Record as held</SubmitButton>
                  </ActionForm>
                )}
              </div>
            ))}</div>}
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Past</h2><p>{past.length} held or cancelled</p></div></div>
            {past.length === 0 ? <p className="empty-state">No past events yet.</p> : <div className="record-list">{past.map((event) => (
              <div className="record-row" key={event.id}>
                <div><strong>{event.eventDate} · {event.title}</strong>
                  <small>{[humanize(event.eventType), event.actualAttendance !== null && `${event.actualAttendance} attended`, event.partnerId && partnerName.get(event.partnerId)].filter(Boolean).join(" · ")}</small>
                  {event.outcome && <small className="material-text">{event.outcome}</small>}
                </div>
                <span className={`role-badge status-${event.status === "held" ? "active" : "inactive"}`}>{event.status}</span>
              </div>
            ))}</div>}
          </section>
        </>}

        {tab === "partners" && <>
          <section className="management-card">
            <h2>Add a partner</h2>
            <RecordForm action={addPartner} hidden={{ schoolId }} submitLabel="Add partner" fields={[
              { name: "name", label: "Name", required: true, max: 160, placeholder: "Abay PTSA, local health centre…" },
              { name: "partnerType", label: "Type", type: "select", required: true, options: enumOptions(PARTNER_TYPES) },
              { name: "contactName", label: "Contact person", max: 120 },
              { name: "phone", label: "Phone", type: "tel", max: 40 },
              { name: "email", label: "Email", type: "email", max: 254 },
              { name: "notes", label: "What they do with the school", type: "textarea", max: 1000 },
            ]} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Partners</h2><p>{partners.length} recorded</p></div></div>
            {partners.length === 0 ? <p className="empty-state">No partners yet.</p> : <div className="record-list">{partners.map((partner) => {
              const linked = events.filter((event) => event.partnerId === partner.id).length;
              return (
                <div className="record-row" key={partner.id}>
                  <div><strong>{partner.name}</strong>
                    <small>{[humanize(partner.partnerType), partner.contactName, partner.phone, partner.email, `${linked} event${linked === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</small>
                    {partner.notes && <small className="material-text">{partner.notes}</small>}
                  </div>
                  <span className={`role-badge status-${partner.status}`}>{partner.status}</span>
                  <RowButton action={setPartnerStatus} hidden={{ schoolId, partnerId: partner.id, status: partner.status === "active" ? "inactive" : "active" }} label={partner.status === "active" ? "Deactivate" : "Reactivate"} />
                </div>
              );
            })}</div>}
          </section>
        </>}

        {tab === "volunteers" && <>
          <section className="management-card">
            <h2>Register a volunteer</h2>
            <RecordForm action={addVolunteer} hidden={{ schoolId }} submitLabel="Register" fields={[
              { name: "name", label: "Name", required: true, max: 160 },
              { name: "phone", label: "Phone", type: "tel", max: 40 },
              { name: "email", label: "Email", type: "email", max: 254 },
              { name: "partnerId", label: "From partner", type: "select", options: partnerOptions },
              { name: "skills", label: "Skills", max: 300, placeholder: "Tutoring, carpentry, first aid…" },
              { name: "availability", label: "Availability", max: 200, placeholder: "Saturdays" },
            ]} />
          </section>
          <section className="management-card">
            <div className="management-card-heading"><div><h2>Volunteers</h2><p>{totalHours} hours contributed</p></div></div>
            {people.length === 0 ? <p className="empty-state">No volunteers yet.</p> : <div className="record-list">{people.map((person) => (
              <div className="record-row" key={person.id}>
                <div><strong>{person.name}</strong>
                  <small>{[person.skills, person.availability, person.partnerId && partnerName.get(person.partnerId), person.phone, person.email].filter(Boolean).join(" · ")}</small></div>
                <span className="role-badge">{person.hoursContributed} h</span>
                <ActionForm action={logVolunteerHours} className="inline-actions">
                  <input name="schoolId" type="hidden" value={schoolId} />
                  <input name="volunteerId" type="hidden" value={person.id} />
                  <input aria-label={`Hours for ${person.name}`} className="number-input" max={200} min={1} name="hours" required type="number" />
                  <SubmitButton pendingLabel="Saving…">Add hours</SubmitButton>
                </ActionForm>
              </div>
            ))}</div>}
          </section>
        </>}
      </div>
    </main>
  );
}

export default function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p>Loading community...</p></main>}><CommunityContent searchParams={searchParams} /></Suspense>;
}
