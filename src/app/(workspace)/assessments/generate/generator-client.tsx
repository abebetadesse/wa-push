"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateAssessmentPlanAction, saveAssessmentPlanAction } from "./actions";
import type { GeneratedQuestion } from "@/lib/quiz-generator";

type School = { id: string; name: string };
type AcademicYear = { id: string; schoolId: string; name: string; isCurrent: boolean };
type GradeLevel = { id: string; schoolId: string; name: string };
type Subject = { id: string; schoolId: string; name: string };
type Classroom = { id: string; schoolId: string; name: string; academicYearId: string; gradeLevelId: string };
type Resource = { id: string; schoolId: string; title: string; fileName: string; gradeLevelId?: string | null; subjectId?: string | null };

export function AssessmentGeneratorClient(props: {
  schools: School[];
  years: AcademicYear[];
  grades: GradeLevel[];
  subjects: Subject[];
  classrooms: Classroom[];
  resources: Resource[];
  canPublish: boolean;
}) {
  const { schools, years, grades, subjects, classrooms, resources, canPublish } = props;
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselectedResourceId = searchParams.get("resourceId") || "";
  const preselectedGradeId = searchParams.get("gradeLevelId") || "";
  const preselectedSubjectId = searchParams.get("subjectId") || "";

  const defaultSchoolId = schools[0]?.id || "";
  const [selectedSchoolId, setSelectedSchoolId] = useState(defaultSchoolId);

  const availableYears = years.filter((y) => y.schoolId === selectedSchoolId);
  const currentYear = availableYears.find((y) => y.isCurrent) || availableYears[0];
  const [selectedYearId, setSelectedYearId] = useState(currentYear?.id || "");

  const availableGrades = grades.filter((g) => g.schoolId === selectedSchoolId);
  const [selectedGradeId, setSelectedGradeId] = useState(preselectedGradeId || availableGrades[0]?.id || "");

  const availableSubjects = subjects.filter((s) => s.schoolId === selectedSchoolId);
  const [selectedSubjectId, setSelectedSubjectId] = useState(preselectedSubjectId || availableSubjects[0]?.id || "");

  const availableClassrooms = classrooms.filter(
    (c) => c.schoolId === selectedSchoolId && (!selectedGradeId || c.gradeLevelId === selectedGradeId),
  );
  const [selectedClassroomId, setSelectedClassroomId] = useState(availableClassrooms[0]?.id || "");

  const availableResources = resources.filter((r) => r.schoolId === selectedSchoolId);
  const [selectedResourceId, setSelectedResourceId] = useState(preselectedResourceId || "");
  const [assessmentType, setAssessmentType] = useState<"quiz" | "exercise" | "exam">("quiz");
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [customText, setCustomText] = useState("");

  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Generated state
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [generatedInstructions, setGeneratedInstructions] = useState("");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

  const handleGenerate = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const gradeObj = availableGrades.find((g) => g.id === selectedGradeId);
    const subObj = availableSubjects.find((s) => s.id === selectedSubjectId);

    if (!selectedSchoolId || !selectedYearId || !selectedClassroomId) {
      setErrorMsg("Please ensure School, Academic Year, and Classroom are selected.");
      return;
    }

    startGenerating(async () => {
      const res = await generateAssessmentPlanAction({
        schoolId: selectedSchoolId,
        resourceId: selectedResourceId || undefined,
        customText: customText.trim() || undefined,
        subjectName: subObj?.name || "Subject",
        gradeName: gradeObj?.name || "Grade",
        type: assessmentType,
        maxQuestions,
      });

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      if (res.plan) {
        setGeneratedTitle(res.plan.title);
        setGeneratedInstructions(res.plan.instructions);
        setQuestions(res.plan.questions);
        setSuccessMsg(`Generated ${res.plan.questions.length} questions from curriculum textbook! Review or edit below before publishing.`);
      }
    });
  };

  const handleQuestionChange = <K extends keyof GeneratedQuestion>(index: number, field: K, value: GeneratedQuestion[K]) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const newOpts = [...updated[qIndex].options];
      newOpts[optIndex] = value;
      updated[qIndex] = { ...updated[qIndex], options: newOpts };
      return updated;
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        questionText: "New question prompt...",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctOption: 0,
        points: 1,
        explanation: "Teacher explanation...",
        topicTag: "General",
      },
    ]);
  };

  const handleSave = (status: "draft" | "published") => {
    if (!generatedTitle.trim()) {
      setErrorMsg("Assessment title is required.");
      return;
    }
    if (questions.length === 0) {
      setErrorMsg("Please generate or add at least one question.");
      return;
    }

    startSaving(async () => {
      const res = await saveAssessmentPlanAction({
        schoolId: selectedSchoolId,
        academicYearId: selectedYearId,
        classroomId: selectedClassroomId,
        subjectId: selectedSubjectId,
        title: generatedTitle.trim(),
        instructions: generatedInstructions.trim(),
        status,
        questions: questions.map((q) => ({
          questionText: q.questionText,
          options: q.options,
          correctOption: q.correctOption,
          points: q.points,
        })),
      });

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      setSuccessMsg(`Assessment successfully ${status === "published" ? "published for students" : "saved as draft"}! Redirecting...`);
      setTimeout(() => {
        router.push("/assessments");
      }, 1200);
    });
  };

  return (
    <div className="generator-container" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {errorMsg && (
        <div className="form-error" style={{ padding: "1rem", borderRadius: "8px", backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: "1rem", borderRadius: "8px", backgroundColor: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Step 1: Configuration Form */}
      <section className="management-card" style={{ padding: "1.75rem", borderRadius: "14px", backgroundColor: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem", color: "#0f172a" }}>
          1. Select Textbook &amp; Class Target
        </h2>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Choose an Ethiopian curriculum textbook or paste syllabus topics to automatically generate aligned questions and answer keys.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {schools.length > 1 && (
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>School</label>
              <select
                className="form-input"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Academic Year</label>
            <select
              className="form-input"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              {availableYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? "(Current)" : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Grade Level</label>
            <select
              className="form-input"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
            >
              {availableGrades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Subject</label>
            <select
              className="form-input"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Target Classroom</label>
            <select
              className="form-input"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              value={selectedClassroomId}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
            >
              {availableClassrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Textbook & Format */}
        <div style={{ marginTop: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>
              Curriculum Textbook / Learning Resource
            </label>
            <select
              className="form-input"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
            >
              <option value="">— Use Standard Curriculum Topics —</option>
              {availableResources.map((r) => (
                <option key={r.id} value={r.id}>
                  📖 {r.title} ({r.fileName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Assessment Type</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(
                [
                  { type: "quiz", label: "Quiz (MCQ)" },
                  { type: "exercise", label: "Review Exercises" },
                  { type: "exam", label: "Curriculum Exam" },
                ] as const
              ).map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setAssessmentType(t.type)}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.5rem",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: assessmentType === t.type ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    backgroundColor: assessmentType === t.type ? "#eff6ff" : "#fff",
                    color: assessmentType === t.type ? "#1d4ed8" : "#475569",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>
              Number of Questions ({maxQuestions})
            </label>
            <input
              type="range"
              min={3}
              max={25}
              value={maxQuestions}
              onChange={(e) => setMaxQuestions(Number(e.target.value))}
              style={{ width: "100%", marginTop: "0.4rem" }}
            />
          </div>
        </div>

        {/* Optional custom text */}
        <div style={{ marginTop: "1rem" }}>
          <details>
            <summary style={{ fontSize: "0.85rem", color: "#475569", cursor: "pointer", fontWeight: 600 }}>
              + Custom Syllabus / Specific Chapter Notes (Optional)
            </summary>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Paste specific textbook chapter text, definitions, or unit questions to steer generation..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              style={{ width: "100%", marginTop: "0.5rem", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
            />
          </details>
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="primary-button"
            disabled={isGenerating}
            onClick={handleGenerate}
            style={{
              padding: "0.65rem 1.5rem",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "0.95rem",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              color: "#fff",
              border: "none",
              cursor: isGenerating ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
            }}
          >
            {isGenerating ? "⏳ Analyzing Textbook & Generating Questions..." : "✨ Generate Assessment from Textbook"}
          </button>
        </div>
      </section>

      {/* Step 2: Interactive Questions Review & Editing */}
      {questions.length > 0 && (
        <section className="management-card" style={{ padding: "1.75rem", borderRadius: "14px", backgroundColor: "#fff", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                2. Review &amp; Edit Generated Assessment ({questions.length} Questions)
              </h2>
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Teachers can fine-tune question prompts, edit distractors, select the correct answer, or add custom questions before saving.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={handleAddQuestion}
                style={{ padding: "0.5rem 0.9rem", fontSize: "0.85rem", fontWeight: 600 }}
              >
                + Add Question
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={isSaving}
                onClick={() => handleSave("draft")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", fontWeight: 600 }}
              >
                Save as Draft
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isSaving}
                onClick={() => handleSave("published")}
                style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem", fontWeight: 700, backgroundColor: "#059669", borderColor: "#059669" }}
              >
                {canPublish ? "🚀 Save & Publish Immediately" : "Save Assessment"}
              </button>
            </div>
          </div>

          {/* Assessment Title & Instructions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Assessment Title</label>
              <input
                type="text"
                className="form-input"
                value={generatedTitle}
                onChange={(e) => setGeneratedTitle(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: 600 }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>Student Instructions</label>
              <input
                type="text"
                className="form-input"
                value={generatedInstructions}
                onChange={(e) => setGeneratedInstructions(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>

          {/* Question List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {questions.map((q, qIdx) => (
              <div
                key={q.tempId}
                style={{
                  padding: "1.25rem",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>Question {qIdx + 1}</span>
                    {q.topicTag && (
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "10px", backgroundColor: "#e2e8f0", color: "#475569" }}>
                        {q.topicTag}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                  >
                    ✕ Delete
                  </button>
                </div>

                <textarea
                  className="form-input"
                  rows={2}
                  value={q.questionText}
                  onChange={(e) => handleQuestionChange(qIdx, "questionText", e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "0.75rem", fontSize: "0.9rem" }}
                />

                {/* 4 Options with Radio Button for Correct Answer */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.correctOption === optIdx;
                    return (
                      <div
                        key={optIdx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.4rem 0.6rem",
                          borderRadius: "8px",
                          border: isCorrect ? "2px solid #10b981" : "1px solid #e2e8f0",
                          backgroundColor: isCorrect ? "#ecfdf5" : "#fff",
                        }}
                      >
                        <input
                          type="radio"
                          name={`correct-${q.tempId}`}
                          checked={isCorrect}
                          onChange={() => handleQuestionChange(qIdx, "correctOption", optIdx)}
                          title="Set as correct answer"
                        />
                        <span style={{ fontWeight: 700, fontSize: "0.8rem", color: isCorrect ? "#047857" : "#64748b" }}>
                          {String.fromCharCode(65 + optIdx)}:
                        </span>
                        <input
                          type="text"
                          className="form-input"
                          value={opt}
                          onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                          style={{
                            flex: 1,
                            padding: "0.25rem 0.4rem",
                            border: "none",
                            background: "transparent",
                            fontSize: "0.85rem",
                            color: isCorrect ? "#065f46" : "#1e293b",
                            fontWeight: isCorrect ? 600 : 400,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.6rem", fontStyle: "italic" }}>
                    💡 Explanation: {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: "1.75rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button
              type="button"
              className="secondary-button"
              disabled={isSaving}
              onClick={() => handleSave("draft")}
              style={{ padding: "0.65rem 1.25rem", fontSize: "0.9rem", fontWeight: 600 }}
            >
              Save as Draft
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={isSaving}
              onClick={() => handleSave("published")}
              style={{ padding: "0.65rem 1.75rem", fontSize: "0.95rem", fontWeight: 700, backgroundColor: "#059669", borderColor: "#059669" }}
            >
              {isSaving ? "⏳ Saving Assessment..." : canPublish ? "🚀 Save & Publish for Students" : "Save Assessment"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
