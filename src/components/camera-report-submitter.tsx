"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { submitPhotoReport, type PhotoReportActionState } from "@/app/(workspace)/reports/photo-actions";
import type { ReportSection } from "@/lib/transcription";

export type CameraReportContextOptions = {
  schools: { id: string; name: string }[];
  currentSchoolId: string;
  defaultSection?: ReportSection;
  classrooms?: { id: string; name: string; gradeName?: string }[];
  subjects?: { id: string; name: string }[];
  lessonPlans?: { id: string; title: string }[];
  assessments?: { id: string; title: string; classroomName?: string }[];
  triggerButtonText?: string;
  className?: string;
  startOpen?: boolean;
  onSubmitted?: () => void;
};

const SECTION_OPTIONS: { id: ReportSection; label: string; icon: string; desc: string }[] = [
  { id: "lessons", label: "Lesson Plans & Notes", icon: "📚", desc: "Board notes, lesson delivery notes, teaching reflections" },
  { id: "attendance", label: "Attendance & Roll Call", icon: "✅", desc: "Handwritten daily attendance sheets, absentees list" },
  { id: "assessments", label: "Quizzes & Score Sheets", icon: "📝", desc: "Handwritten test scores, grading rubrics, exam marks" },
  { id: "facilities", label: "Laboratories & Facilities", icon: "🔬", desc: "Equipment status, chemicals log, workshop incidents" },
  { id: "general", label: "General Teacher Report", icon: "📊", desc: "Weekly summaries, administrative notes, student welfare" },
];

export function CameraReportSubmitter({
  schools,
  currentSchoolId,
  defaultSection = "general",
  classrooms = [],
  subjects = [],
  lessonPlans = [],
  assessments = [],
  triggerButtonText = "📷 Submit Photo Report",
  className = "",
  startOpen = false,
  onSubmitted,
}: CameraReportContextOptions) {
  const [isOpen, setIsOpen] = useState(startOpen);
  const [selectedSchoolId, setSelectedSchoolId] = useState(currentSchoolId);
  const [section, setSection] = useState<ReportSection>(defaultSection);
  const [title, setTitle] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [transcription, setTranscription] = useState("");

  // Linked entities
  const [classroomId, setClassroomId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [lessonPlanId, setLessonPlanId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  // AI Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeNotice, setTranscribeNotice] = useState<string | null>(null);

  // Submission state
  const [isPending, startTransition] = useTransition();
  const [submitResult, setSubmitResult] = useState<PhotoReportActionState | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Start live camera stream
  const startCamera = useCallback(async (mode: "environment" | "user" = facingMode) => {
    setCameraError(null);
    stopCamera();
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is not supported in this browser. Please use the upload button.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setFacingMode(mode);
    } catch (err) {
      console.warn("Live camera start failed:", err);
      setCameraError(
        err instanceof Error
          ? err.message
          : "Camera permission denied or camera unavailable. You can upload an image file instead.",
      );
      setCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  // Flip camera between front & back
  const flipCamera = useCallback(() => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    startCamera(nextMode);
  }, [facingMode, startCamera]);

  // Capture snapshot from live video
  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 250);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhotoDataUrl(dataUrl);
    stopCamera();

    // Auto-fill a clean default title if blank
    if (!title) {
      const secMeta = SECTION_OPTIONS.find((s) => s.id === section);
      setTitle(`${secMeta?.label || "Report"} - ${reportDate}`);
    }
  }, [notes, reportDate, section, stopCamera, title]);

  // Retake photo: clear existing snapshot and restart camera
  const retakePhoto = useCallback(() => {
    setPhotoDataUrl(null);
    setTranscribeNotice(null);
    startCamera();
  }, [startCamera]);

  // Handle direct file input or device native camera capture
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPhotoDataUrl(result);
        stopCamera();
        if (!title) {
          const secMeta = SECTION_OPTIONS.find((s) => s.id === section);
          setTitle(`${secMeta?.label || "Report"} - ${reportDate}`);
        }
      }
    };
    reader.readAsDataURL(file);
  }, [reportDate, section, stopCamera, title]);

  // Clean up camera when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  // Trigger AI Vision Transcription
  const runTranscription = useCallback(async () => {
    if (!photoDataUrl) return;
    setIsTranscribing(true);
    setTranscribeNotice(null);

    try {
      const response = await fetch("/api/teacher-reports/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: photoDataUrl,
          section,
          contextHint: `Classroom: ${classroomId || "N/A"}, Subject: ${subjectId || "N/A"}`,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to transcribe image");
      }

      if (data.transcription) {
        setTranscription(data.transcription);
      }
      if (data.suggestedTitle && !title) {
        setTitle(data.suggestedTitle);
      }
      if (data.detectedSection && data.detectedSection !== section) {
        // Keep or suggest section
        setSection(data.detectedSection);
      }

      if (data.message) {
        setTranscribeNotice(data.message);
      } else {
        setTranscribeNotice(`Transcribed successfully (${data.wordCount || 0} words recognized). You can review and edit below.`);
      }
    } catch (err) {
      console.error("Transcription call error:", err);
      setTranscribeNotice(err instanceof Error ? err.message : "Transcription failed. You can type notes directly.");
    } finally {
      setIsTranscribing(false);
    }
  }, [classroomId, photoDataUrl, section, subjectId, title]);

  // Submit complete report (photo + transcription)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoDataUrl) {
      setSubmitResult({ error: "Please take or upload a photo of the report." });
      return;
    }
    if (!title.trim()) {
      setSubmitResult({ error: "Please enter a report title." });
      return;
    }

    setSubmitResult(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("schoolId", selectedSchoolId);
      formData.set("section", section);
      formData.set("title", title);
      formData.set("reportDate", reportDate);
      formData.set("photoData", photoDataUrl);
      formData.set("transcription", transcription);
      formData.set("notes", notes);
      if (classroomId) formData.set("classroomId", classroomId);
      if (subjectId) formData.set("subjectId", subjectId);
      if (lessonPlanId) formData.set("lessonPlanId", lessonPlanId);
      if (assessmentId) formData.set("assessmentId", assessmentId);

      const result = await submitPhotoReport({}, formData);
      setSubmitResult(result);
      if (result.success) {
        setTimeout(() => {
          onSubmitted?.();
          // Reset form
          setPhotoDataUrl(null);
          setTranscription("");
          setTitle("");
          setNotes("");
        }, 1200);
      }
    });
  };

  const openModal = () => {
    setIsOpen(true);
    setSubmitResult(null);
    // Start camera immediately on opening if not already snapped
    if (!photoDataUrl) {
      startCamera();
    }
  };

  const closeModal = () => {
    stopCamera();
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`primary-button camera-submit-btn ${className}`}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
      >
        <span>📷</span>
        <span>{triggerButtonText}</span>
      </button>

      {isOpen && (
        <div className="camera-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="camera-modal-title">
          <div className="camera-modal-container">
            <header className="camera-modal-header">
              <div>
                <span className="camera-eyebrow">TEACHER REPORT CAPTURE</span>
                <h2 id="camera-modal-title">Snap &amp; Submit Report</h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="camera-modal-close"
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleSubmit} className="camera-modal-form">
              {submitResult?.error && (
                <div className="camera-alert error">
                  <span>⚠️</span> {submitResult.error}
                </div>
              )}
              {submitResult?.success && (
                <div className="camera-alert success">
                  <span>✓</span> {submitResult.success}
                </div>
              )}

              {/* Step 1: Camera Viewfinder / Photo Preview */}
              <div className="camera-viewfinder-card">
                {flashActive && <div className="camera-shutter-flash" />}

                {photoDataUrl ? (
                  <div className="camera-preview-box">
                    <img src={photoDataUrl} alt="Captured teacher report preview" className="camera-preview-img" />
                    <div className="camera-preview-overlay">
                      <span className="camera-status-pill">Photo Captured</span>
                      <div className="camera-preview-actions">
                        <button
                          type="button"
                          onClick={retakePhoto}
                          className="secondary-button retake-btn"
                        >
                          🔄 Retake Photo
                        </button>
                        <button
                          type="button"
                          onClick={runTranscription}
                          disabled={isTranscribing}
                          className="primary-button transcribe-btn"
                        >
                          {isTranscribing ? "⏳ Transcribing..." : "⚡ Transcribe with AI"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="camera-stream-box">
                    {cameraActive ? (
                      <>
                        <video ref={videoRef} autoPlay playsInline muted className="camera-live-video" />
                        <div className="camera-grid-frame">
                          <span className="corner top-left" />
                          <span className="corner top-right" />
                          <span className="corner bottom-left" />
                          <span className="corner bottom-right" />
                          <div className="viewfinder-hint">Align report sheet inside frame</div>
                        </div>

                        <div className="camera-controls-strip">
                          <button
                            type="button"
                            onClick={flipCamera}
                            title="Switch camera"
                            className="camera-icon-btn"
                          >
                            🔄 Flip
                          </button>

                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="camera-shutter-button"
                            title="Take photo"
                          >
                            <span className="shutter-inner" />
                          </button>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload from device"
                            className="camera-icon-btn"
                          >
                            📁 File
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="camera-standby-box">
                        <div className="camera-standby-icon">📷</div>
                        <p className="camera-standby-title">Live Camera Capture</p>
                        <p className="camera-standby-text">
                          Use your device camera to capture classroom notes, attendance sheets, or quiz marks directly.
                        </p>
                        {cameraError && <div className="camera-error-banner">{cameraError}</div>}
                        <div className="camera-standby-actions">
                          <button
                            type="button"
                            onClick={() => startCamera()}
                            className="primary-button"
                          >
                            Start Camera
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="secondary-button"
                          >
                            📁 Choose Photo / Native Camera
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Hidden input for device camera or image file picker */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>

              {/* Step 2: Target Section Selection */}
              <div className="camera-section-selector">
                <label className="camera-label">
                  <strong>Submit to Respective Section:</strong>
                  <span className="camera-sublabel">Select where this report should be filed in Forma</span>
                </label>
                <div className="camera-section-pills">
                  {SECTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSection(opt.id)}
                      className={`camera-section-pill ${section === opt.id ? "active" : ""}`}
                    >
                      <span className="pill-icon">{opt.icon}</span>
                      <span className="pill-title">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Context Fields based on Section */}
              <div className="camera-form-grid">
                {schools.length > 1 && (
                  <label className="camera-field">
                    <span>School</span>
                    <select
                      value={selectedSchoolId}
                      onChange={(e) => setSelectedSchoolId(e.target.value)}
                    >
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="camera-field flex-2">
                  <span>Report Title *</span>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Grade 9 Chemistry Lab Session Notes"
                  />
                </label>

                <label className="camera-field">
                  <span>Report Date</span>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                </label>

                {/* Classroom selector when applicable */}
                {["lessons", "attendance", "assessments"].includes(section) && classrooms.length > 0 && (
                  <label className="camera-field">
                    <span>Classroom (Optional)</span>
                    <select
                      value={classroomId}
                      onChange={(e) => setClassroomId(e.target.value)}
                    >
                      <option value="">— Select Classroom —</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.gradeName ? `${c.gradeName} - ` : ""}
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Subject selector when applicable */}
                {["lessons", "assessments"].includes(section) && subjects.length > 0 && (
                  <label className="camera-field">
                    <span>Subject (Optional)</span>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                    >
                      <option value="">— Select Subject —</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Linked Lesson Plan when section is lessons */}
                {section === "lessons" && lessonPlans.length > 0 && (
                  <label className="camera-field flex-2">
                    <span>Linked Lesson Plan (Optional)</span>
                    <select
                      value={lessonPlanId}
                      onChange={(e) => setLessonPlanId(e.target.value)}
                    >
                      <option value="">— Unlinked / Standalone Report —</option>
                      {lessonPlans.map((lp) => (
                        <option key={lp.id} value={lp.id}>
                          {lp.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Linked Assessment when section is assessments */}
                {section === "assessments" && assessments.length > 0 && (
                  <label className="camera-field flex-2">
                    <span>Linked Quiz / Assessment (Optional)</span>
                    <select
                      value={assessmentId}
                      onChange={(e) => setAssessmentId(e.target.value)}
                    >
                      <option value="">— Unlinked Score Sheet —</option>
                      {assessments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title} {a.classroomName ? `(${a.classroomName})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {/* Step 3: Transcribed Text & Editing */}
              <div className="camera-transcription-box">
                <div className="transcription-header">
                  <div>
                    <strong>Transcribed Text &amp; Notes:</strong>
                    <span className="transcription-hint">
                      {isTranscribing
                        ? "Transcribing photo with AI..."
                        : photoDataUrl
                        ? "Click 'Transcribe with AI' above or type / edit below"
                        : "Take a photo to enable automatic transcription"}
                    </span>
                  </div>
                  {photoDataUrl && (
                    <button
                      type="button"
                      onClick={runTranscription}
                      disabled={isTranscribing}
                      className="transcribe-chip-btn"
                    >
                      {isTranscribing ? "⏳ Processing..." : "⚡ Transcribe Photo"}
                    </button>
                  )}
                </div>

                {transcribeNotice && (
                  <div className="camera-notice-bar">
                    <span>ℹ️</span> {transcribeNotice}
                  </div>
                )}

                <textarea
                  rows={7}
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="The photo transcription will appear here. You can also edit, format, or type observations directly..."
                  className="transcription-textarea"
                />

                <div className="transcription-footer">
                  <span>Markdown formatting supported (tables, bullet lists, bold)</span>
                  <span>{transcription.split(/\s+/).filter(Boolean).length} words</span>
                </div>
              </div>

              {/* Additional Teacher Comments */}
              <label className="camera-field full-width">
                <span>Teacher's Note / Remarks for Administration (Optional)</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Follow-up required next Monday for absent students."
                />
              </label>

              {/* Modal Actions */}
              <div className="camera-modal-actions">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="secondary-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !photoDataUrl}
                  className="primary-button submit-report-final"
                >
                  {isPending ? "Submitting Report..." : `Submit to ${section.toUpperCase()} ➔`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
