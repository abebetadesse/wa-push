"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { withBasePath } from "@/lib/base-path";
import { CURRICULUM_SUBJECTS } from "@/lib/ethiopian-curriculum";

type Option = { id: string; name: string };

/**
 * Uploads a textbook or teacher guide PDF. For a school it goes to the school's library under a
 * grade and subject; for the platform catalog (`catalog`) every school can then add it.
 */
export function TextbookUploadForm({ schoolId, grades, subjects, catalog = false, preset }: {
  schoolId?: string;
  grades?: Option[];
  subjects?: Option[];
  catalog?: boolean;
  preset?: { gradeLevelId?: string; subjectId?: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(withBasePath(catalog ? "/api/textbook-catalog" : "/api/resources"), { method: "POST", body: new FormData(form) });
      const result = await response.json().catch(() => ({})) as { error?: string; success?: string };
      if (!response.ok) {
        setMessage({ text: result.error ?? (response.status === 413 ? "The file is too large (100 MB at most)." : "The PDF could not be uploaded."), error: true });
        return;
      }
      setMessage({ text: result.success ?? "Uploaded.", error: false });
      form.reset();
      router.refresh();
    } catch {
      setMessage({ text: "The upload could not be completed. Check your connection and try again.", error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={upload}>
      {schoolId && <input name="schoolId" type="hidden" value={schoolId} />}
      <div className="form-two-columns">
        {catalog ? (
          <>
            <label>Grade
              <select defaultValue="" name="grade" required>
                <option disabled value="">Choose…</option>
                {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>Grade {index + 1}</option>)}
              </select>
            </label>
            <label>Subject
              <select defaultValue="" name="subjectName" required>
                <option disabled value="">Choose…</option>
                {CURRICULUM_SUBJECTS.map((subject) => <option key={subject.code} value={subject.name}>{subject.name}</option>)}
              </select>
            </label>
          </>
        ) : (
          <>
            <label>Grade
              <select defaultValue={preset?.gradeLevelId ?? ""} name="gradeLevelId" required>
                <option disabled value="">Choose…</option>
                {grades?.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
              </select>
            </label>
            <label>Subject
              <select defaultValue={preset?.subjectId ?? ""} name="subjectId" required>
                <option disabled value="">Choose…</option>
                {subjects?.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
          </>
        )}
        <label>Kind
          <select defaultValue="student_textbook" name="kind">
            <option value="student_textbook">Student textbook</option>
            <option value="teacher_guide">Teacher guide</option>
          </select>
        </label>
        {catalog
          ? <label>Language<input defaultValue="English" maxLength={40} name="language" required /></label>
          : <label>Title <span className="optional-label">Optional</span><input maxLength={200} name="title" placeholder="Taken from the file name" /></label>}
        {catalog && <label>Title <span className="optional-label">Optional</span><input maxLength={200} name="title" /></label>}
        {catalog && <label>Publisher<input defaultValue="Ministry of Education, FDRE" maxLength={160} name="publisher" /></label>}
        <label className="form-wide">PDF file (up to 100 MB)<input accept="application/pdf,.pdf" name="file" required type="file" /></label>
      </div>
      {message && <p className={message.error ? "auth-error" : "auth-success"} role={message.error ? "alert" : "status"}>{message.text}</p>}
      <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Uploading…" : catalog ? "Upload to the catalog" : "Upload to the library"}</button>
    </form>
  );
}
