"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { bulkImportStudents, type BulkImportActionState } from "./actions";
import type { StudentClassOption, StudentSchoolOption } from "./student-form";

const SAMPLE_CSV = `student_number,first_name,last_name,email,date_of_birth,class_name
STU-1001,Abebe,Bekele,abebe.b@example.com,2010-04-12,Grade 9A
STU-1002,Sara,Tadesse,sara.t@example.com,2010-08-25,Grade 9A
STU-1003,Dawit,Haile,,2009-11-03,Grade 9B
STU-1004,Marta,Kassa,marta.k@example.com,2010-01-19,Grade 9B`;

export function BulkStudentImportForm({
  schools,
  classrooms,
}: {
  schools: StudentSchoolOption[];
  classrooms: StudentClassOption[];
}) {
  const [state, action, pending] = useActionState<BulkImportActionState, FormData>(bulkImportStudents, {});
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [csvContent, setCsvContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableClasses = useMemo(
    () => classrooms.filter((classroom) => classroom.schoolId === schoolId),
    [classrooms, schoolId],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "students_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lineCount = useMemo(() => {
    return csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0).length;
  }, [csvContent]);

  return (
    <form action={action} className="auth-form bulk-import-form">
      {schools.length > 1 && (
        <label>
          School
          <select
            name="schoolId"
            onChange={(event) => setSchoolId(event.target.value)}
            required
            value={schoolId}
          >
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {schools.length === 1 && <input name="schoolId" type="hidden" value={schools[0].id} />}

      <label>
        Default classroom <span className="optional-label">Optional fallback</span>
        <select disabled={!availableClasses.length} name="defaultClassroomId" defaultValue="">
          <option value="">
            {availableClasses.length
              ? "None (use class specified in CSV row)"
              : "No current classrooms configured"}
          </option>
          {availableClasses.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.gradeName} {classroom.name} · {classroom.academicYearName}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", gap: "10px", alignItems: "center", margin: "4px 0 8px" }}>
        <button
          type="button"
          onClick={downloadSampleCsv}
          className="secondary-button"
          style={{ fontSize: "11px", padding: "6px 12px" }}
        >
          📥 Download CSV template
        </button>
        <button
          type="button"
          onClick={() => setCsvContent(SAMPLE_CSV)}
          className="secondary-button"
          style={{ fontSize: "11px", padding: "6px 12px" }}
        >
          Load example data
        </button>
      </div>

      <label>
        Upload CSV file <span className="optional-label">or paste below</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={handleFileUpload}
        />
      </label>

      <label>
        CSV text content
        {lineCount > 0 && <span className="optional-label">({lineCount} lines detected)</span>}
        <textarea
          name="csvContent"
          rows={6}
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          placeholder={`student_number,first_name,last_name,email,date_of_birth,class_name\nSTU-1001,Abebe,Bekele,abebe@example.com,2010-04-12,Grade 9A`}
          required
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: 1.4,
            padding: "8px 10px",
            border: "1px solid #e2e2ec",
            borderRadius: "6px",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      </label>

      <p className="setup-hint" style={{ marginTop: "4px" }}>
        Columns: <code>student_number, first_name, last_name, email, date_of_birth, class_name</code>.
        Headers are skipped automatically. Date format: YYYY-MM-DD.
      </p>

      {state.error && (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="auth-success" role="status">
          {state.success}
        </p>
      )}

      {state.details && state.details.length > 0 && (
        <div
          style={{
            background: "#fff9f2",
            border: "1px solid #ffe3c7",
            borderRadius: "6px",
            padding: "10px",
            fontSize: "11px",
            color: "#854900",
            maxHeight: "140px",
            overflowY: "auto",
          }}
        >
          <strong>Import report details:</strong>
          <ul style={{ margin: "5px 0 0", paddingLeft: "16px" }}>
            {state.details.map((detail, idx) => (
              <li key={idx}>{detail}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        className="primary-button auth-submit"
        disabled={pending || !csvContent.trim()}
        type="submit"
      >
        {pending ? "Importing students..." : "Import students from CSV"}
      </button>
    </form>
  );
}
