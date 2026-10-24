"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { bulkImportStudents, type BulkImportActionState } from "./actions";
import type { StudentClassOption, StudentSchoolOption } from "./student-form";
import { parseCsvRecords } from "@/lib/csv";

const SAMPLE_CSV = `student_number,first_name,last_name,email,date_of_birth,class_name,guardian_email
STU-1001,Abebe,Bekele,abebe.b@example.com,2010-04-12,Grade 9A,parent.b@example.com
STU-1002,Sara,Tadesse,sara.t@example.com,2010-08-25,Grade 9A,parent.t@example.com
STU-1003,Dawit,Haile,,2009-11-03,Grade 9B,
STU-1004,Marta,Kassa,marta.k@example.com,2010-01-19,Grade 9B,guardian.k@example.com`;

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

  const preview = useMemo(() => {
    if (!csvContent.trim()) return { count: 0, issues: [] as string[] };
    try {
      const records = parseCsvRecords(csvContent);
      const start = records[0]?.join(" ").toLowerCase().match(/student|name|number|first/) ? 1 : 0;
      const classes = new Set(availableClasses.flatMap(({ name, gradeName }) => [name.toLowerCase(), `${gradeName} ${name}`.toLowerCase()]));
      const numbers = new Set<string>();
      const issues: string[] = [];
      for (const [index, row] of records.slice(start).entries()) {
        const number = row[0]?.trim() ?? "";
        if (!number || !row[1]?.trim() || !row[2]?.trim()) issues.push(`Row ${index + start + 1}: Student number and first/last name are required.`);
        if (number && numbers.has(number.toLowerCase())) issues.push(`Row ${index + start + 1}: Duplicate student number "${number}" in this file.`);
        if (number) numbers.add(number.toLowerCase());
        if (row[5]?.trim() && !classes.has(row[5].trim().toLowerCase())) issues.push(`Row ${index + start + 1}: Class "${row[5]}" is not in the selected school.`);
        const guardianEmail = row[6]?.trim() ?? "";
        if (guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) issues.push(`Row ${index + start + 1}: Guardian email is invalid.`);
      }
      if (records.length - start > 500) issues.push("Import is limited to 500 students at a time.");
      return { count: records.length - start, issues: issues.slice(0, 10) };
    } catch (error) {
      return { count: 0, issues: [error instanceof Error ? error.message : "Could not parse CSV."] };
    }
  }, [csvContent, availableClasses]);

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

      <div className="inline-actions">
        <button type="button" onClick={downloadSampleCsv} className="secondary-button record-action">
          Download CSV template
        </button>
        <button type="button" onClick={() => setCsvContent(SAMPLE_CSV)} className="secondary-button record-action">
          Load example data
        </button>
        {csvContent && (
          <button
            type="button"
            onClick={() => {
              setCsvContent("");
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="secondary-button record-action"
          >
            Clear
          </button>
        )}
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
        {preview.count > 0 && <span className="optional-label">({preview.count} student rows detected)</span>}
        <textarea
          name="csvContent"
          rows={6}
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          placeholder={`student_number,first_name,last_name,email,date_of_birth,class_name\nSTU-1001,Abebe,Bekele,abebe@example.com,2010-04-12,Grade 9A`}
          required
          className="csv-textarea"
        />
      </label>

      <p className="setup-hint">
        Columns: <code>student_number, first_name, last_name, email, date_of_birth, class_name, guardian_email</code>.
        Headers are skipped automatically. Date format: YYYY-MM-DD.
      </p>
      {csvContent.trim() && <div className={preview.issues.length ? "import-details" : "setup-hint"} aria-live="polite">
        <strong>{preview.issues.length ? "Preflight checks:" : `${preview.count} rows ready to import.`}</strong>
        {preview.issues.length > 0 && <ul>{preview.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
      </div>}

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
        <div className="import-details">
          <strong>Import report details:</strong>
          <ul>
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
