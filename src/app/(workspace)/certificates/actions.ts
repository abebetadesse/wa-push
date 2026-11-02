"use server";

import { guardAction, UserError, type ActionState } from "@/lib/action-result";

import { randomBytes } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  academicYears,
  certificates,
  certificateTemplates,
  classrooms,
  enrollments,
  gradeLevels,
  schools,
  staffMembers,
  students,
  teachers,
  type CertificateDesign,
  type CertificateElement,
  type CertificateVariable,
} from "@/db/schema";
import { withBasePath } from "@/lib/base-path";
import { BORDERS, CERTIFICATE_AUDIENCES, ELEMENT_KINDS, FONTS, type CertificateAudience } from "@/lib/certificates";
import { fieldValueAsInput, withFormulas } from "@/lib/custom-fields";
import { currentEthiopianYear, fieldsForSchool, loadFieldValues } from "@/lib/field-data";
import { loadHierarchy, schoolPlacement } from "@/lib/hierarchy";
import { canAdministerUnit, isPlatformAdmin, requirePrivilege, requireSession, type PrivilegeScope } from "@/lib/permissions";

function readScope(formData: FormData): PrivilegeScope {
  const [type, id = ""] = String(formData.get("scope") ?? "").split(":");
  if (type === "platform") return { type, id: "" };
  if ((type === "org_unit" || type === "school") && /^[0-9a-f-]{36}$/i.test(id)) return { type, id };
  throw new UserError("Choose who may use the template.");
}

async function requireTemplateAccess(scope: PrivilegeScope, action: "add" | "edit" | "delete") {
  const session = await requireSession();
  if (isPlatformAdmin(session)) return session;
  if (scope.type === "platform") throw new UserError("Only the super administrator can make templates for every school.");
  if (scope.type === "org_unit") {
    if (!(await canAdministerUnit(scope.id))) throw new UserError("Only an administrator of this unit can change its templates.");
    return session;
  }
  await requirePrivilege(scope.id, "certificates", action);
  return session;
}

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

function readTemplate(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 160) throw new UserError("Name the template (up to 160 characters).");
  const audience = String(formData.get("audience") ?? "") as CertificateAudience;
  if (!CERTIFICATE_AUDIENCES.includes(audience)) throw new UserError("Choose who receives it.");
  let raw: { design: CertificateDesign; elements: CertificateElement[]; variables: CertificateVariable[] };
  try {
    raw = JSON.parse(String(formData.get("template") ?? ""));
  } catch {
    throw new UserError("The design could not be read.");
  }
  const design: CertificateDesign = {
    orientation: raw.design?.orientation === "portrait" ? "portrait" : "landscape",
    background: HEX.test(raw.design?.background) ? raw.design.background : "#ffffff",
    border: BORDERS.includes(raw.design?.border) ? raw.design.border : "classic",
    borderColor: HEX.test(raw.design?.borderColor) ? raw.design.borderColor : "#b08d3c",
    accent: HEX.test(raw.design?.accent) ? raw.design.accent : "#1d3a6e",
    watermark: String(raw.design?.watermark ?? "").slice(0, 40),
  };
  if (!Array.isArray(raw.elements) || raw.elements.length > 60) throw new UserError("Use at most 60 elements.");
  const elements: CertificateElement[] = raw.elements.map((element, index) => ({
    id: String(element.id ?? `el${index}`).slice(0, 40),
    kind: ELEMENT_KINDS.some((entry) => entry.kind === element.kind) ? element.kind : "text",
    text: String(element.text ?? "").slice(0, 600),
    x: clamp(element.x, 0, 100, 50),
    y: clamp(element.y, 0, 100, 50),
    width: clamp(element.width, 2, 100, 60),
    fontSize: clamp(element.fontSize, 4, 120, 16),
    bold: Boolean(element.bold),
    italic: Boolean(element.italic),
    color: HEX.test(element.color) ? element.color : "#1f2937",
    align: element.align === "left" || element.align === "right" ? element.align : "center",
    font: FONTS.includes(element.font) ? element.font : "serif",
  }));
  if (!Array.isArray(raw.variables) || raw.variables.length > 20) throw new UserError("Use at most 20 issue values.");
  const variables = raw.variables.map((variable) => ({
    key: String(variable.key ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40),
    label: String(variable.label ?? "").slice(0, 80),
    defaultValue: String(variable.defaultValue ?? "").slice(0, 300),
  })).filter((variable) => variable.key && variable.label);
  return { name, audience, design, elements, variables };
}

async function saveTemplateImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const templateId = String(formData.get("templateId") ?? "");
  const values = readTemplate(formData);
  if (templateId) {
    const [template] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, templateId)).limit(1);
    if (!template) throw new UserError("That template no longer exists.");
    await requireTemplateAccess(template.scopeType === "platform" ? { type: "platform", id: "" } : { type: template.scopeType, id: template.scopeId }, "edit");
    await db.update(certificateTemplates).set(values).where(eq(certificateTemplates.id, templateId));
  } else {
    const scope = readScope(formData);
    const session = await requireTemplateAccess(scope, "add");
    await db.insert(certificateTemplates).values({ ...values, scopeType: scope.type, scopeId: scope.id, createdBy: session.user.id });
  }
  revalidatePath("/certificates");
  return { success: `“${values.name}” was saved.` };
}

async function archiveTemplateImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const [template] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, String(formData.get("templateId") ?? ""))).limit(1);
  if (!template) throw new UserError("That template no longer exists.");
  await requireTemplateAccess(template.scopeType === "platform" ? { type: "platform", id: "" } : { type: template.scopeType, id: template.scopeId }, "delete");
  await db.update(certificateTemplates).set({ isActive: formData.get("active") === "on" }).where(eq(certificateTemplates.id, template.id));
  revalidatePath("/certificates");
  return {};
}

// Without look-alike characters (0/O, 1/I/L), so a code read off paper is typed correctly.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function verificationCode() {
  return [...randomBytes(8)].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function verifyUrl(code: string) {
  const origin = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : "";
  return `${origin}${withBasePath(`/verify/${code}`)}`.replace(/^https?:\/\//, "");
}

type Recipient = { id: string; firstName: string; lastName: string; number: string; gender: string | null; title: string; grade: string; className: string };

async function loadRecipients(audience: CertificateAudience, schoolId: string, ids: string[]): Promise<Recipient[]> {
  if (ids.length === 0) return [];
  if (audience === "student") {
    const rows = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, number: students.studentNumber, gender: students.gender })
      .from(students).where(and(eq(students.schoolId, schoolId), inArray(students.id, ids)));
    const placed = await db.select({ studentId: enrollments.studentId, grade: gradeLevels.name, className: classrooms.name })
      .from(enrollments)
      .innerJoin(academicYears, and(eq(enrollments.academicYearId, academicYears.id), eq(academicYears.isCurrent, true)))
      .innerJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .innerJoin(gradeLevels, eq(classrooms.gradeLevelId, gradeLevels.id))
      .where(inArray(enrollments.studentId, ids));
    return rows.map((row) => ({ ...row, title: "Student", grade: placed.find((entry) => entry.studentId === row.id)?.grade ?? "", className: placed.find((entry) => entry.studentId === row.id)?.className ?? "" }));
  }
  if (audience === "teacher") {
    const rows = await db.select({ id: teachers.id, firstName: teachers.firstName, lastName: teachers.lastName, number: teachers.teacherNumber, gender: teachers.gender, title: teachers.specialization })
      .from(teachers).where(and(eq(teachers.schoolId, schoolId), inArray(teachers.id, ids)));
    return rows.map((row) => ({ ...row, title: row.title ?? "Teacher", grade: "", className: "" }));
  }
  const rows = await db.select({ id: staffMembers.id, firstName: staffMembers.firstName, lastName: staffMembers.lastName, number: staffMembers.employeeNumber, title: staffMembers.jobTitle })
    .from(staffMembers).where(and(eq(staffMembers.schoolId, schoolId), inArray(staffMembers.id, ids)));
  return rows.map((row) => ({ ...row, gender: null, grade: "", className: "" }));
}

async function issueCertificatesImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const schoolId = String(formData.get("schoolId") ?? "");
  const access = await requirePrivilege(schoolId, "certificates", "add");
  const [template] = await db.select().from(certificateTemplates).where(and(eq(certificateTemplates.id, String(formData.get("templateId") ?? "")), eq(certificateTemplates.isActive, true))).limit(1);
  if (!template) throw new UserError("Choose a template.");
  const ids = [...new Set(formData.getAll("recipientIds").map(String))].slice(0, 500);
  const recipients = await loadRecipients(template.audience, schoolId, ids);
  if (recipients.length === 0) throw new UserError(`Choose at least one ${template.audience}.`);

  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
  const hierarchy = await loadHierarchy();
  const placement = schoolPlacement(hierarchy, schoolId);
  const [year] = await db.select({ name: academicYears.name }).from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true))).limit(1);
  const period = currentEthiopianYear();
  const entity = template.audience === "student" ? "student" : template.audience === "teacher" ? "teacher" : "staff";
  const [recipientFields, schoolFields] = await Promise.all([fieldsForSchool(schoolId, entity), fieldsForSchool(schoolId, "school")]);
  const [recipientValues, schoolValues] = await Promise.all([
    loadFieldValues(recipientFields, recipients.map((recipient) => recipient.id), period),
    loadFieldValues(schoolFields, [schoolId], period),
  ]);
  const schoolCustom = withFormulas(schoolFields, schoolValues.get(schoolId) ?? new Map());
  const variables = Object.fromEntries(template.variables.map((variable) => [`var.${variable.key}`, String(formData.get(`var.${variable.key}`) ?? variable.defaultValue).trim().slice(0, 300)]));
  const prefix = (school.schoolCode || school.slug).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "CERT";
  const [{ issued }] = await db.select({ issued: count() }).from(certificates).where(eq(certificates.schoolId, schoolId));
  const issuedOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const rows = recipients.map((recipient, index) => {
    const code = verificationCode();
    const serial = `${prefix}-${period.slice(0, 4)}-${String(Number(issued) + index + 1).padStart(4, "0")}`;
    const custom = withFormulas(recipientFields, recipientValues.get(recipient.id) ?? new Map());
    const data: Record<string, string> = {
      "recipient.fullName": `${recipient.firstName} ${recipient.lastName}`,
      "recipient.firstName": recipient.firstName,
      "recipient.lastName": recipient.lastName,
      "recipient.number": recipient.number,
      "recipient.gender": recipient.gender === "female" ? "Female" : recipient.gender === "male" ? "Male" : "",
      "recipient.grade": recipient.grade,
      "recipient.class": recipient.className,
      "recipient.title": recipient.title,
      "school.name": school.name,
      "school.kebele": school.kebele ?? "",
      "school.code": school.schoolCode ?? "",
      "school.cluster": placement.cluster,
      "school.woreda": placement.woreda,
      "school.zone": placement.zone,
      "school.region": placement.region,
      "year.current": year?.name ?? "",
      "year.ethiopian": period,
      "date.issued": issuedOn,
      "certificate.serial": serial,
      "certificate.code": `${code.slice(0, 4)}-${code.slice(4)}`,
      "certificate.verifyUrl": verifyUrl(code),
      ...variables,
      ...Object.fromEntries([...custom].map(([key, value]) => [`custom.${key}`, fieldValueAsInput(value)])),
      ...Object.fromEntries([...schoolCustom].map(([key, value]) => [`school.custom.${key}`, fieldValueAsInput(value)])),
    };
    return {
      templateId: template.id,
      schoolId,
      recipientType: template.audience,
      recipientId: recipient.id,
      recipientName: data["recipient.fullName"].slice(0, 220),
      serial,
      verificationCode: code,
      data,
      issuedBy: access.session.user.id,
    };
  });
  await db.insert(certificates).values(rows);
  revalidatePath("/certificates");
  revalidatePath("/my-progress");
  return { success: `Issued ${rows.length} certificate${rows.length === 1 ? "" : "s"}. Print them from the Issued tab.` };
}

async function revokeCertificateImpl(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const [certificate] = await db.select().from(certificates).where(eq(certificates.id, String(formData.get("certificateId") ?? ""))).limit(1);
  if (!certificate) throw new UserError("Certificate not found.");
  await requirePrivilege(certificate.schoolId, "certificates", "delete");
  await db.update(certificates).set({ revokedAt: formData.get("restore") === "on" ? null : new Date() }).where(eq(certificates.id, certificate.id));
  revalidatePath("/certificates");
  return {};
}

export async function saveTemplate(...args: Parameters<typeof saveTemplateImpl>) { return guardAction(() => saveTemplateImpl(...args)); }
export async function archiveTemplate(...args: Parameters<typeof archiveTemplateImpl>) { return guardAction(() => archiveTemplateImpl(...args)); }
export async function issueCertificates(...args: Parameters<typeof issueCertificatesImpl>) { return guardAction(() => issueCertificatesImpl(...args)); }
export async function revokeCertificate(...args: Parameters<typeof revokeCertificateImpl>) { return guardAction(() => revokeCertificateImpl(...args)); }
