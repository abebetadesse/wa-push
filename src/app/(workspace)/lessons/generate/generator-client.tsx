"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { GeneratedLessonPlan } from "@/lib/lesson-generator";
import { batchSaveLessonPlans, previewLessonPlans } from "./actions";

type SchoolOption = { id: string; name: string };
type YearOption = { id: string; schoolId: string; name: string; isCurrent: boolean };
type GradeOption = { id: string; schoolId: string; name: string };
type SubjectOption = { id: string; schoolId: string; name: string };
type ClassroomOption = { id: string; schoolId: string; name: string; academicYearId: string; gradeLevelId: string };
type TeacherOption = { id: string; schoolId: string; name: string };
type ResourceOption = { id: string; schoolId: string; title: string; fileName: string; sizeBytes: number };

export function GeneratorClient(props: {
  schools: SchoolOption[];
  years: YearOption[];
  grades: GradeOption[];
  subjects: SubjectOption[];
  classrooms: ClassroomOption[];
  teachers: TeacherOption[];
  resources: ResourceOption[];
  canApprove: boolean;
  userRole?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramResourceId = searchParams.get("resourceId") ?? "";
  const paramGradeId = searchParams.get("gradeLevelId") ?? "";
  const paramSubjectId = searchParams.get("subjectId") ?? "";

  const [selectedSchoolId, setSelectedSchoolId] = useState(props.schools[0]?.id ?? "");
  const [selectedYearId, setSelectedYearId] = useState(
    props.years.find((y) => y.schoolId === selectedSchoolId && y.isCurrent)?.id ??
    props.years.find((y) => y.schoolId === selectedSchoolId)?.id ?? ""
  );
  const [selectedGradeId, setSelectedGradeId] = useState(
    paramGradeId || (props.grades.find((g) => g.schoolId === selectedSchoolId)?.id ?? "")
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    paramSubjectId || (props.subjects.find((s) => s.schoolId === selectedSchoolId)?.id ?? "")
  );
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [sourceType, setSourceType] = useState<"resource" | "text">("resource");
  const [selectedResourceId, setSelectedResourceId] = useState(paramResourceId || "");
  const [customText, setCustomText] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const [generatedPlans, setGeneratedPlans] = useState<GeneratedLessonPlan[]>([]);
  const [activePlanIndex, setActivePlanIndex] = useState<number | null>(0);
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filtered dropdown lists based on selected school
  const filteredYears = props.years.filter((y) => y.schoolId === selectedSchoolId);
  const filteredGrades = props.grades.filter((g) => g.schoolId === selectedSchoolId);
  const filteredSubjects = props.subjects.filter((s) => s.schoolId === selectedSchoolId);
  const filteredClassrooms = props.classrooms.filter(
    (c) => c.schoolId === selectedSchoolId && (!selectedYearId || c.academicYearId === selectedYearId)
  );
  const filteredTeachers = props.teachers.filter((t) => t.schoolId === selectedSchoolId);
  const filteredResources = props.resources.filter((r) => r.schoolId === selectedSchoolId);

  const handleSchoolChange = (newSchoolId: string) => {
    setSelectedSchoolId(newSchoolId);
    const newYear = props.years.find((y) => y.schoolId === newSchoolId && y.isCurrent)?.id ??
      props.years.find((y) => y.schoolId === newSchoolId)?.id ?? "";
    setSelectedYearId(newYear);
    setSelectedGradeId(props.grades.find((g) => g.schoolId === newSchoolId)?.id ?? "");
    setSelectedSubjectId(props.subjects.find((s) => s.schoolId === newSchoolId)?.id ?? "");
    setSelectedClassroomId("");
    setSelectedTeacherId("");
    setSelectedResourceId("");
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const formData = new FormData();
    formData.append("schoolId", selectedSchoolId);
    formData.append("academicYearId", selectedYearId);
    formData.append("gradeLevelId", selectedGradeId);
    formData.append("subjectId", selectedSubjectId);
    if (selectedClassroomId) formData.append("classroomId", selectedClassroomId);
    if (selectedTeacherId) formData.append("teacherId", selectedTeacherId);
    if (sourceType === "resource" && selectedResourceId) {
      formData.append("resourceId", selectedResourceId);
    }
    if (customText) formData.append("customText", customText);
    formData.append("startDate", startDate);

    startGenerating(async () => {
      const res = await previewLessonPlans(formData);
      if (res.error) {
        setStatusMessage({ type: "error", text: res.error });
      } else if (res.plans) {
        setGeneratedPlans(res.plans);
        setActivePlanIndex(0);
        setStatusMessage({
          type: "success",
          text: `Generated ${res.plans.length} structured lesson plans. Review and edit below, then choose to save or approve immediately.`,
        });
      }
    });
  };

  const handlePlanFieldChange = (index: number, field: keyof GeneratedLessonPlan, value: string | number) => {
    setGeneratedPlans((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveBatch = (initialStatus: "draft" | "submitted" | "approved") => {
    if (generatedPlans.length === 0) return;
    setStatusMessage(null);

    const formData = new FormData();
    formData.append("schoolId", selectedSchoolId);
    formData.append("academicYearId", selectedYearId);
    formData.append("gradeLevelId", selectedGradeId);
    formData.append("subjectId", selectedSubjectId);
    if (selectedClassroomId) formData.append("classroomId", selectedClassroomId);
    if (selectedTeacherId) formData.append("teacherId", selectedTeacherId);
    if (sourceType === "resource" && selectedResourceId) {
      formData.append("sourceResourceId", selectedResourceId);
    }
    formData.append("initialStatus", initialStatus);
    formData.append("plansJson", JSON.stringify(generatedPlans));

    startSaving(async () => {
      const res = await batchSaveLessonPlans(formData);
      if (res.error) {
        setStatusMessage({ type: "error", text: res.error });
      } else if (res.success) {
        setStatusMessage({ type: "success", text: res.success });
        setGeneratedPlans([]);
        router.refresh();
      }
    });
  };

  // Unique units count
  const unitList = Array.from(new Set(generatedPlans.map((p) => p.unitTopic)));

  return (
    <div className="management-sections">
      {statusMessage && (
        <div
          className={`auth-alert ${statusMessage.type === "error" ? "auth-error" : "auth-success"}`}
          role="alert"
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "0.5rem",
            marginBottom: "1.5rem",
            background: statusMessage.type === "error" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
            border: `1px solid ${statusMessage.type === "error" ? "#ef4444" : "#22c55e"}`,
            color: statusMessage.type === "error" ? "#b91c1c" : "#15803d",
          }}
        >
          <strong>{statusMessage.type === "error" ? "Notice: " : "Success: "}</strong>
          {statusMessage.text}
        </div>
      )}

      {/* Generator Configuration Card */}
      <section className="management-card">
        <div className="management-card-heading">
          <div>
            <h2>Curriculum &amp; Resource Input</h2>
            <p>Select your course scope, choose a textbook or resource, and align with the timetable.</p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="auth-form" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
          <label>
            School workspace
            <select
              value={selectedSchoolId}
              onChange={(e) => handleSchoolChange(e.target.value)}
              required
            >
              {props.schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label>
            Academic Year
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              required
            >
              <option value="">Select academic year</option>
              {filteredYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? "(Current)" : ""}</option>
              ))}
            </select>
          </label>

          <label>
            Grade Level
            <select
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              required
            >
              <option value="">Select grade level</option>
              {filteredGrades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>

          <label>
            Subject
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              required
            >
              <option value="">Select subject</option>
              {filteredSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label>
            Classroom <span className="optional-label">Optional (for timetable mapping)</span>
            <select
              value={selectedClassroomId}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
            >
              <option value="">All or independent class</option>
              {filteredClassrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label>
            Teacher <span className="optional-label">Optional</span>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              <option value="">Unassigned or self</option>
              {filteredTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <label>
            Start Schedule Date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>

          {/* Content Source Selection */}
          <div style={{ gridColumn: "1 / -1", marginTop: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              Textbook &amp; Content Source
            </span>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="sourceType"
                  checked={sourceType === "resource"}
                  onChange={() => setSourceType("resource")}
                />
                Use Uploaded Learning Resource / Textbook
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="sourceType"
                  checked={sourceType === "text"}
                  onChange={() => setSourceType("text")}
                />
                Paste Syllabus / Textbook Outline Text
              </label>
            </div>

            {sourceType === "resource" ? (
              <label>
                Select learning resource file
                <select
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                >
                  <option value="">Choose an uploaded document / textbook...</option>
                  {filteredResources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.fileName})
                    </option>
                  ))}
                </select>
                {filteredResources.length === 0 && (
                  <small style={{ color: "#6b7280", marginTop: "0.25rem", display: "block" }}>
                    No learning resources found for this school. You can{" "}
                    <Link href="/resources" className="text-link" target="_blank">
                      upload a textbook here
                    </Link>{" "}
                    or switch to text outline below.
                  </small>
                )}
              </label>
            ) : (
              <label>
                Textbook outline, chapters, or syllabus description
                <textarea
                  rows={5}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder={"Unit 1: Introduction to Mechanics\nLesson 1: Speed, Velocity and Acceleration\nLesson 2: Newton's Laws of Motion\nUnit 2: Work, Energy and Power\nLesson 1: Kinetic and Potential Energy"}
                />
              </label>
            )}
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button
              type="submit"
              className="primary-button"
              disabled={isGenerating || !selectedSchoolId || !selectedSubjectId}
              style={{ minWidth: "220px" }}
            >
              {isGenerating ? "Analyzing & Generating Plans…" : "⚡ Auto-Generate Lesson Plans"}
            </button>
          </div>
        </form>
      </section>

      {/* Generated Plans Review & Approval Section */}
      {generatedPlans.length > 0 && (
        <section className="management-card" style={{ border: "2px solid #3b82f6" }}>
          <div className="management-card-heading" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <div>
              <span className="role-badge status-approved" style={{ marginRight: "0.5rem" }}>
                {generatedPlans.length} Plans Ready
              </span>
              <h2 style={{ display: "inline" }}>Generated Curriculum Lesson Plans</h2>
              <p style={{ marginTop: "0.25rem" }}>
                Review, edit in-line, and approve or submit the entire set immediately.
              </p>
            </div>

            {/* Batch Approval & Save Actions */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary-button"
                disabled={isSaving}
                onClick={() => handleSaveBatch("draft")}
              >
                {isSaving ? "Saving…" : "Save All as Drafts"}
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={isSaving}
                onClick={() => handleSaveBatch("submitted")}
                style={{ background: "#2563eb" }}
              >
                {isSaving ? "Submitting…" : "Submit All for Admin Review"}
              </button>

              {props.canApprove && (
                <button
                  type="button"
                  className="primary-button"
                  disabled={isSaving}
                  onClick={() => handleSaveBatch("approved")}
                  style={{ background: "#059669", borderColor: "#059669" }}
                >
                  {isSaving ? "Approving…" : "✓ Approve &amp; Provision All"}
                </button>
              )}
            </div>
          </div>

          {/* Unit summary pills */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1rem 0" }}>
            {unitList.map((unit, uIdx) => (
              <span
                key={uIdx}
                style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  color: "#1d4ed8",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              >
                {unit} ({generatedPlans.filter((p) => p.unitTopic === unit).length} lessons)
              </span>
            ))}
          </div>

          {/* Interactive List & Inline Edit Panel */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(360px, 2fr)", gap: "1.5rem", marginTop: "1rem" }}>
            {/* Left Column: Lesson Selector List */}
            <div style={{ borderRight: "1px solid #e5e7eb", paddingRight: "1rem", maxHeight: "680px", overflowY: "auto" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>
                Lesson Plan Sequence
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {generatedPlans.map((plan, idx) => {
                  const isActive = activePlanIndex === idx;
                  return (
                    <button
                      type="button"
                      key={plan.tempId}
                      onClick={() => setActivePlanIndex(idx)}
                      style={{
                        textAlign: "left",
                        padding: "0.75rem",
                        borderRadius: "0.375rem",
                        background: isActive ? "#eff6ff" : "#ffffff",
                        border: `1px solid ${isActive ? "#3b82f6" : "#e5e7eb"}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                        <span>Lesson {idx + 1}</span>
                        <span>{plan.scheduledDate ?? `${plan.durationMinutes} min`}</span>
                      </div>
                      <strong style={{ fontSize: "0.875rem", color: isActive ? "#1e40af" : "#111827", display: "block" }}>
                        {plan.title}
                      </strong>
                      <small style={{ color: "#4b5563" }}>{plan.unitTopic}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Editable Lesson Plan Detail */}
            {activePlanIndex !== null && generatedPlans[activePlanIndex] && (
              <div style={{ background: "#fafafa", padding: "1.25rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.125rem", color: "#111827" }}>
                    Edit Lesson #{activePlanIndex + 1} Details
                  </h3>
                  <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>
                    Changes are preserved in revision history upon saving.
                  </span>
                </div>

                <div style={{ display: "grid", gap: "1rem" }}>
                  <label>
                    Lesson Title
                    <input
                      type="text"
                      value={generatedPlans[activePlanIndex].title}
                      onChange={(e) => handlePlanFieldChange(activePlanIndex, "title", e.target.value)}
                    />
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <label>
                      Unit / Topic
                      <input
                        type="text"
                        value={generatedPlans[activePlanIndex].unitTopic}
                        onChange={(e) => handlePlanFieldChange(activePlanIndex, "unitTopic", e.target.value)}
                      />
                    </label>

                    <label>
                      Scheduled Date
                      <input
                        type="date"
                        value={generatedPlans[activePlanIndex].scheduledDate ?? ""}
                        onChange={(e) => handlePlanFieldChange(activePlanIndex, "scheduledDate", e.target.value)}
                      />
                    </label>
                  </div>

                  <label>
                    Overview &amp; Purpose
                    <textarea
                      rows={3}
                      value={generatedPlans[activePlanIndex].overview}
                      onChange={(e) => handlePlanFieldChange(activePlanIndex, "overview", e.target.value)}
                    />
                  </label>

                  <label>
                    Learning Objectives
                    <textarea
                      rows={4}
                      value={generatedPlans[activePlanIndex].objectives}
                      onChange={(e) => handlePlanFieldChange(activePlanIndex, "objectives", e.target.value)}
                    />
                  </label>

                  <label>
                    Instructional Procedures &amp; Activities (Starter, Main, Plenary)
                    <textarea
                      rows={5}
                      value={generatedPlans[activePlanIndex].procedures}
                      onChange={(e) => handlePlanFieldChange(activePlanIndex, "procedures", e.target.value)}
                    />
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <label>
                      Materials &amp; Equipment
                      <textarea
                        rows={3}
                        value={generatedPlans[activePlanIndex].materials}
                        onChange={(e) => handlePlanFieldChange(activePlanIndex, "materials", e.target.value)}
                      />
                    </label>

                    <label>
                      Differentiation &amp; Scaffolding
                      <textarea
                        rows={3}
                        value={generatedPlans[activePlanIndex].differentiation}
                        onChange={(e) => handlePlanFieldChange(activePlanIndex, "differentiation", e.target.value)}
                      />
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <label>
                      Formative Assessment &amp; Checks
                      <textarea
                        rows={3}
                        value={generatedPlans[activePlanIndex].assessment}
                        onChange={(e) => handlePlanFieldChange(activePlanIndex, "assessment", e.target.value)}
                      />
                    </label>

                    <label>
                      Homework &amp; Practice
                      <textarea
                        rows={3}
                        value={generatedPlans[activePlanIndex].homework}
                        onChange={(e) => handlePlanFieldChange(activePlanIndex, "homework", e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
