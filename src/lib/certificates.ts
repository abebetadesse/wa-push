// Certificate templates: the placeholders a template's text may use, ready-made designs, and how a
// template's text is filled in. No server-only imports: the designer previews with the same code.
import type { CertificateDesign, CertificateElement, CertificateVariable } from "@/db/schema";

export const CERTIFICATE_AUDIENCES = ["student", "teacher", "staff"] as const;
export type CertificateAudience = (typeof CERTIFICATE_AUDIENCES)[number];

export const PLACEHOLDERS: { key: string; label: string; sample: string }[] = [
  { key: "recipient.fullName", label: "Recipient's full name", sample: "Hanna Tesfaye" },
  { key: "recipient.firstName", label: "First name", sample: "Hanna" },
  { key: "recipient.lastName", label: "Last name", sample: "Tesfaye" },
  { key: "recipient.number", label: "Student / teacher / employee number", sample: "S-0042" },
  { key: "recipient.gender", label: "Sex", sample: "Female" },
  { key: "recipient.grade", label: "Grade (students)", sample: "KG 3" },
  { key: "recipient.class", label: "Class (students)", sample: "KG 3A" },
  { key: "recipient.title", label: "Job title / specialization", sample: "Pre-primary teacher" },
  { key: "school.name", label: "School name", sample: "Genet Preschool" },
  { key: "school.kebele", label: "Kebele", sample: "Addis Genet" },
  { key: "school.code", label: "School code", sample: "50305230132" },
  { key: "school.cluster", label: "Cluster", sample: "Genet cluster" },
  { key: "school.woreda", label: "Woreda", sample: "Wereda 05" },
  { key: "school.zone", label: "Zone / sub-city", sample: "Kolfe Keraniyo" },
  { key: "school.region", label: "Region", sample: "Addis Ababa" },
  { key: "year.current", label: "Academic year", sample: "2026/27" },
  { key: "year.ethiopian", label: "Ethiopian year", sample: "2019 E.C." },
  { key: "date.issued", label: "Date issued", sample: "29 October 2026" },
  { key: "certificate.serial", label: "Serial number", sample: "GEN-2019-0001" },
  { key: "certificate.code", label: "Verification code", sample: "K7Q2-M9XA" },
  { key: "certificate.verifyUrl", label: "Verification address", sample: "service.echat.et/school/verify/K7Q2M9XA" },
];

/** Replaces {{key}} with data[key]; {{custom.field_key}} reads data fields and {{var.key}} the issue's own values. */
export function fillText(text: string, data: Record<string, string>) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => data[key] ?? "")
    // Drop the "·" separators left around empty values ("{{school.cluster}} · {{school.woreda}}").
    .replace(/(\s*·\s*){2,}/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "");
}

export function sampleData(variables: CertificateVariable[]) {
  return {
    ...Object.fromEntries(PLACEHOLDERS.map((placeholder) => [placeholder.key, placeholder.sample])),
    ...Object.fromEntries(variables.map((variable) => [`var.${variable.key}`, variable.defaultValue || variable.label])),
  };
}

let counter = 0;
export function newElementId() {
  counter += 1;
  return `el${Date.now().toString(36)}${counter}`;
}

const element = (partial: Partial<CertificateElement> & Pick<CertificateElement, "text" | "y">): CertificateElement => ({
  id: newElementId(),
  kind: "text",
  x: 50,
  width: 80,
  fontSize: 18,
  bold: false,
  italic: false,
  color: "#1f2937",
  align: "center",
  font: "serif",
  ...partial,
});

export const TEMPLATE_PRESETS: { id: string; name: string; audience: CertificateAudience; design: CertificateDesign; elements: CertificateElement[]; variables: CertificateVariable[] }[] = [
  {
    id: "achievement",
    name: "Certificate of achievement",
    audience: "student",
    design: { orientation: "landscape", background: "#fffdf7", border: "ornate", borderColor: "#b08d3c", accent: "#1d3a6e", watermark: "" },
    variables: [{ key: "award", label: "Achievement", defaultValue: "outstanding academic performance" }, { key: "rank", label: "Rank", defaultValue: "1st" }],
    elements: [
      element({ text: "{{school.name}}", y: 12, fontSize: 20, bold: true, color: "#1d3a6e", font: "sans" }),
      element({ text: "{{school.cluster}} · {{school.woreda}} · {{school.region}}", y: 18, fontSize: 11, color: "#6b7280", font: "sans" }),
      element({ text: "Certificate of Achievement", y: 30, fontSize: 40, bold: true, color: "#b08d3c" }),
      element({ text: "የምስክር ወረቀት", y: 39, fontSize: 18, color: "#1d3a6e", font: "sans" }),
      element({ text: "This certificate is proudly presented to", y: 48, fontSize: 15, italic: true }),
      element({ text: "{{recipient.fullName}}", y: 57, fontSize: 36, color: "#111827", font: "script" }),
      element({ text: "of {{recipient.class}} for {{var.award}}, ranking {{var.rank}} in the {{year.current}} academic year.", y: 67, fontSize: 15, width: 70 }),
      element({ kind: "signature", text: "School principal", x: 25, y: 84, width: 26, fontSize: 12, font: "sans" }),
      element({ kind: "seal", text: "{{school.name}}", x: 50, y: 82, width: 14, fontSize: 9, color: "#b08d3c", font: "sans" }),
      element({ kind: "signature", text: "Cluster supervisor", x: 75, y: 84, width: 26, fontSize: 12, font: "sans" }),
      element({ kind: "code", text: "No. {{certificate.serial}} · Verify at {{certificate.verifyUrl}}", y: 95, fontSize: 9, color: "#6b7280", font: "sans", width: 90 }),
    ],
  },
  {
    id: "completion",
    name: "Pre-primary completion certificate",
    audience: "student",
    design: { orientation: "landscape", background: "#f7fbff", border: "double", borderColor: "#2a78d6", accent: "#2a78d6", watermark: "KG" },
    variables: [{ key: "level", label: "Level completed", defaultValue: "pre-primary education (KG 1–3)" }],
    elements: [
      element({ text: "{{school.name}}", y: 13, fontSize: 22, bold: true, color: "#184f95", font: "sans" }),
      element({ text: "Certificate of Completion", y: 28, fontSize: 38, bold: true, color: "#2a78d6" }),
      element({ text: "This is to certify that", y: 42, fontSize: 15, italic: true }),
      element({ text: "{{recipient.fullName}}", y: 52, fontSize: 34, bold: true, color: "#111827" }),
      element({ text: "has successfully completed {{var.level}} in the {{year.ethiopian}} school year.", y: 63, fontSize: 15, width: 72 }),
      element({ kind: "signature", text: "Principal", x: 28, y: 83, width: 26, fontSize: 12, font: "sans" }),
      element({ kind: "signature", text: "Homeroom teacher", x: 72, y: 83, width: 26, fontSize: 12, font: "sans" }),
      element({ kind: "code", text: "{{certificate.serial}} · code {{certificate.code}} · issued {{date.issued}}", y: 95, fontSize: 9, color: "#6b7280", font: "sans", width: 90 }),
    ],
  },
  {
    id: "teacher-appreciation",
    name: "Teacher appreciation / training certificate",
    audience: "teacher",
    design: { orientation: "landscape", background: "#ffffff", border: "modern", borderColor: "#1baf7a", accent: "#0f6b4a", watermark: "" },
    variables: [{ key: "reason", label: "For", defaultValue: "completing 40 hours of in-service pre-primary training" }, { key: "hours", label: "Hours", defaultValue: "40" }],
    elements: [
      element({ text: "{{school.woreda}} Education Office · {{school.cluster}}", y: 12, fontSize: 14, color: "#0f6b4a", font: "sans", bold: true }),
      element({ text: "Certificate of Appreciation", y: 27, fontSize: 38, bold: true, color: "#0f6b4a" }),
      element({ text: "Awarded to", y: 40, fontSize: 15, italic: true }),
      element({ text: "{{recipient.fullName}}", y: 50, fontSize: 34, color: "#111827", font: "script" }),
      element({ text: "{{recipient.title}}, {{school.name}}", y: 58, fontSize: 14, color: "#4b5563", font: "sans" }),
      element({ text: "for {{var.reason}}.", y: 67, fontSize: 15, width: 70 }),
      element({ kind: "signature", text: "Woreda education head", x: 28, y: 84, width: 26, fontSize: 12, font: "sans" }),
      element({ kind: "signature", text: "Cluster supervisor", x: 72, y: 84, width: 26, fontSize: 12, font: "sans" }),
      element({ kind: "code", text: "{{certificate.serial}} · verify: {{certificate.verifyUrl}}", y: 95, fontSize: 9, color: "#6b7280", font: "sans", width: 90 }),
    ],
  },
];

export const BORDERS: CertificateDesign["border"][] = ["classic", "double", "modern", "ornate", "none"];
export const FONTS: CertificateElement["font"][] = ["serif", "sans", "script"];
export const ELEMENT_KINDS: { kind: CertificateElement["kind"]; label: string }[] = [
  { kind: "text", label: "Text" },
  { kind: "signature", label: "Signature line" },
  { kind: "seal", label: "Seal / stamp" },
  { kind: "line", label: "Divider line" },
  { kind: "code", label: "Serial & verification" },
];
