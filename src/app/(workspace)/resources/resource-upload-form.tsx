"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { withBasePath } from "@/lib/base-path";

type SchoolOption = { id: string; name: string };

export function ResourceUploadForm({ schools }: { schools: SchoolOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function uploadResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(withBasePath("/api/resources"), {
        method: "POST",
        body: new FormData(form),
      });
      const result = await response.json() as { error?: string; success?: string };
      if (!response.ok) {
        setIsError(true);
        setMessage(result.error ?? "The resource could not be uploaded.");
        return;
      }
      setIsError(false);
      setMessage(result.success ?? "Resource uploaded.");
      form.reset();
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("The upload could not be completed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={uploadResource}>
      {schools.length > 1
        ? <label>School<select name="schoolId" required defaultValue={schools[0]?.id ?? ""}>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        : <input name="schoolId" type="hidden" value={schools[0]?.id ?? ""} />}
      <label>Resource title <span className="optional-label">Optional</span><input maxLength={200} name="title" /></label>
      <label>Description <span className="optional-label">Optional</span><textarea maxLength={2000} name="description" rows={3} /></label>
      <label>File<input accept=".pdf,.txt,.md,.html,.htm,.xml,.csv,.rtf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.epub,.zip,.mbz,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp3,.m4a,.aac,.wav,.ogg,.flac,.mid,.midi,.mp4,.m4v,.mkv,.3gp,.webm,.mov,.mpeg,.mpg,.avi,.json" name="file" required type="file" /></label>
      <p className="setup-hint">Documents, text, spreadsheets, presentations, eBooks, images, animations, audio, video, and archives up to 100 MB. Staff upload resources; active students and authorized staff can access them.</p>
      {message && <p className={isError ? "auth-error" : "auth-success"} role={isError ? "alert" : "status"}>{message}</p>}
      <button className="primary-button auth-submit" disabled={pending || schools.length === 0} type="submit">{pending ? "Uploading..." : "Upload resource"}</button>
    </form>
  );
}
