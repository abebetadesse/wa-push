"use client";

import { useMemo, useState, useTransition } from "react";
import { deletePhotoReport, reviewPhotoReport } from "@/app/(workspace)/reports/photo-actions";
import type { ReportSection } from "@/lib/transcription";

export type SerializedTeacherReport = {
  id: string;
  schoolId: string;
  teacherId: string | null;
  teacherName: string;
  submittedByName: string;
  isOwnReport: boolean;
  isAdmin: boolean;
  title: string;
  section: ReportSection;
  reportDate: string;
  photoUrl: string;
  photoFileName: string;
  photoSizeBytes: number;
  transcription: string | null;
  transcriptionStatus: string;
  notes: string | null;
  classroomName: string | null;
  subjectName: string | null;
  lessonPlanTitle: string | null;
  assessmentTitle: string | null;
  status: "submitted" | "reviewed" | "archived";
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewFeedback: string | null;
  createdAt: string;
};

const SECTION_BADGES: Record<ReportSection, { label: string; icon: string; colorClass: string }> = {
  lessons: { label: "Lessons", icon: "📚", colorClass: "badge-lessons" },
  attendance: { label: "Attendance", icon: "✅", colorClass: "badge-attendance" },
  assessments: { label: "Assessments", icon: "📝", colorClass: "badge-assessments" },
  facilities: { label: "Facilities", icon: "🔬", colorClass: "badge-facilities" },
  general: { label: "General", icon: "📊", colorClass: "badge-general" },
};

export function PhotoReportsList({
  reports,
  schoolId,
  isAdmin,
}: {
  reports: SerializedTeacherReport[];
  schoolId: string;
  isAdmin: boolean;
}) {
  const [filterSection, setFilterSection] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<SerializedTeacherReport | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (filterSection !== "all" && report.section !== filterSection) return false;
      if (filterStatus !== "all" && report.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = report.title.toLowerCase().includes(query);
        const matchesAuthor = report.teacherName.toLowerCase().includes(query) || report.submittedByName.toLowerCase().includes(query);
        const matchesTranscript = (report.transcription ?? "").toLowerCase().includes(query);
        const matchesClass = (report.classroomName ?? "").toLowerCase().includes(query);
        const matchesSubject = (report.subjectName ?? "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesAuthor && !matchesTranscript && !matchesClass && !matchesSubject) {
          return false;
        }
      }
      return true;
    });
  }, [filterSection, filterStatus, reports, searchQuery]);

  const handleCopyTranscript = (report: SerializedTeacherReport) => {
    if (!report.transcription) return;
    navigator.clipboard.writeText(report.transcription);
    setCopiedId(report.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReview = (report: SerializedTeacherReport, newStatus: "reviewed" | "submitted") => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reportId", report.id);
      formData.set("schoolId", schoolId);
      formData.set("status", newStatus);
      formData.set("reviewFeedback", feedbackInput || report.reviewFeedback || "");
      await reviewPhotoReport({}, formData);
      setSelectedReport((prev) => (prev?.id === report.id ? { ...prev, status: newStatus, reviewFeedback: feedbackInput } : prev));
      setFeedbackInput("");
    });
  };

  const handleDelete = (report: SerializedTeacherReport) => {
    if (!confirm(`Are you sure you want to delete "${report.title}"?`)) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("reportId", report.id);
      formData.set("schoolId", schoolId);
      await deletePhotoReport({}, formData);
      if (selectedReport?.id === report.id) setSelectedReport(null);
    });
  };

  return (
    <div className="photo-reports-container">
      {/* Search and Filters Bar */}
      <div className="photo-reports-filters">
        <div className="search-wrap">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search report titles, teachers, or transcription text..."
            className="filter-search-input"
          />
        </div>

        <div className="filter-group">
          <label>Section:
            <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
              <option value="all">All Sections ({reports.length})</option>
              <option value="lessons">Lessons ({reports.filter((r) => r.section === "lessons").length})</option>
              <option value="attendance">Attendance ({reports.filter((r) => r.section === "attendance").length})</option>
              <option value="assessments">Assessments ({reports.filter((r) => r.section === "assessments").length})</option>
              <option value="facilities">Facilities ({reports.filter((r) => r.section === "facilities").length})</option>
              <option value="general">General ({reports.filter((r) => r.section === "general").length})</option>
            </select>
          </label>

          <label>Status:
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted ({reports.filter((r) => r.status === "submitted").length})</option>
              <option value="reviewed">Reviewed ({reports.filter((r) => r.status === "reviewed").length})</option>
            </select>
          </label>
        </div>
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <div className="reports-empty-state">
          <div className="empty-icon">📷</div>
          <h3>No Photo Reports Found</h3>
          <p>
            {reports.length === 0
              ? "Teachers have not submitted any camera reports yet. Click 'Submit Photo Report' above to take the first report photo!"
              : "No reports matched the selected filter criteria."}
          </p>
        </div>
      ) : (
        <div className="photo-reports-grid">
          {filteredReports.map((report) => {
            const badge = SECTION_BADGES[report.section] || SECTION_BADGES.general;
            return (
              <article key={report.id} className="photo-report-card">
                <div className="card-thumb-wrap" onClick={() => setSelectedReport(report)}>
                  <img src={report.photoUrl} alt={report.title} loading="lazy" className="card-thumb-img" />
                  <span className={`card-section-badge ${badge.colorClass}`}>
                    {badge.icon} {badge.label}
                  </span>
                  <div className="card-thumb-overlay">
                    <span>🔍 View Full Report</span>
                  </div>
                </div>

                <div className="card-content">
                  <div className="card-header-row">
                    <span className="card-date">{report.reportDate}</span>
                    <span className={`status-pill ${report.status === "reviewed" ? "reviewed" : "submitted"}`}>
                      {report.status === "reviewed" ? "✓ Reviewed" : "Submitted"}
                    </span>
                  </div>

                  <h3 className="card-title" onClick={() => setSelectedReport(report)}>
                    {report.title}
                  </h3>

                  <p className="card-author">
                    By <strong>{report.teacherName || report.submittedByName}</strong>
                  </p>

                  {/* Context Links */}
                  <div className="card-meta-chips">
                    {report.classroomName && <span className="meta-chip">🏫 {report.classroomName}</span>}
                    {report.subjectName && <span className="meta-chip">📖 {report.subjectName}</span>}
                    {report.lessonPlanTitle && <span className="meta-chip">📋 {report.lessonPlanTitle}</span>}
                    {report.assessmentTitle && <span className="meta-chip">📝 {report.assessmentTitle}</span>}
                  </div>

                  {/* Transcribed text excerpt */}
                  {report.transcription ? (
                    <div className="card-transcription-preview">
                      <p>{report.transcription.slice(0, 140)}...</p>
                    </div>
                  ) : (
                    <div className="card-no-transcript">No transcribed text attached.</div>
                  )}

                  <div className="card-footer-actions">
                    <button
                      type="button"
                      onClick={() => setSelectedReport(report)}
                      className="secondary-button card-btn"
                    >
                      Inspect Report
                    </button>

                    {report.transcription && (
                      <button
                        type="button"
                        onClick={() => handleCopyTranscript(report)}
                        className="text-btn"
                        title="Copy transcribed text"
                      >
                        {copiedId === report.id ? "✓ Copied" : "📋 Copy"}
                      </button>
                    )}

                    {(report.isOwnReport || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(report)}
                        className="delete-icon-btn"
                        title="Delete report"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Full Report Inspection Modal */}
      {selectedReport && (
        <div className="report-detail-backdrop" onClick={() => setSelectedReport(null)}>
          <div className="report-detail-modal" onClick={(e) => e.stopPropagation()}>
            <header className="report-detail-header">
              <div>
                <div className="modal-eyebrow">
                  <span className={`section-tag ${SECTION_BADGES[selectedReport.section]?.colorClass}`}>
                    {SECTION_BADGES[selectedReport.section]?.icon} {SECTION_BADGES[selectedReport.section]?.label}
                  </span>
                  <span>{selectedReport.reportDate}</span>
                </div>
                <h2>{selectedReport.title}</h2>
                <p className="submitted-by-line">
                  Submitted by <strong>{selectedReport.teacherName || selectedReport.submittedByName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="close-detail-btn"
              >
                ✕
              </button>
            </header>

            <div className="report-detail-body">
              {/* Left Column: High-Res Photo */}
              <div className="detail-photo-pane">
                <div className="photo-frame">
                  <img
                    src={selectedReport.photoUrl}
                    alt={selectedReport.title}
                    className="detail-full-img"
                  />
                </div>
                <div className="photo-info-row">
                  <span>File: {selectedReport.photoFileName}</span>
                  <span>Size: {Math.round(selectedReport.photoSizeBytes / 1024)} KB</span>
                  <a
                    href={selectedReport.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="external-photo-link"
                  >
                    Open Full Image ↗
                  </a>
                </div>
              </div>

              {/* Right Column: Transcription & Details */}
              <div className="detail-info-pane">
                <div className="detail-section">
                  <div className="detail-section-title">
                    <strong>Transcribed Report Content</strong>
                    {selectedReport.transcription && (
                      <button
                        type="button"
                        onClick={() => handleCopyTranscript(selectedReport)}
                        className="chip-action-btn"
                      >
                        {copiedId === selectedReport.id ? "✓ Copied" : "📋 Copy Transcription"}
                      </button>
                    )}
                  </div>

                  {selectedReport.transcription ? (
                    <div className="detail-transcription-view">
                      <pre className="markdown-pre">{selectedReport.transcription}</pre>
                    </div>
                  ) : (
                    <p className="empty-transcript-note">
                      No text was transcribed for this photo.
                    </p>
                  )}
                </div>

                {selectedReport.notes && (
                  <div className="detail-section">
                    <strong className="detail-section-title">Teacher's Additional Notes</strong>
                    <p className="detail-notes-text">{selectedReport.notes}</p>
                  </div>
                )}

                {/* Metadata details */}
                <div className="detail-meta-box">
                  <div className="meta-item">
                    <span>Classroom:</span>
                    <strong>{selectedReport.classroomName || "—"}</strong>
                  </div>
                  <div className="meta-item">
                    <span>Subject:</span>
                    <strong>{selectedReport.subjectName || "—"}</strong>
                  </div>
                  {selectedReport.lessonPlanTitle && (
                    <div className="meta-item">
                      <span>Lesson Plan:</span>
                      <strong>{selectedReport.lessonPlanTitle}</strong>
                    </div>
                  )}
                  {selectedReport.assessmentTitle && (
                    <div className="meta-item">
                      <span>Assessment:</span>
                      <strong>{selectedReport.assessmentTitle}</strong>
                    </div>
                  )}
                  <div className="meta-item">
                    <span>Status:</span>
                    <strong>{selectedReport.status === "reviewed" ? "✓ Reviewed" : "Submitted"}</strong>
                  </div>
                </div>

                {/* Admin Review Feedback */}
                {selectedReport.reviewFeedback && (
                  <div className="admin-feedback-card">
                    <strong>Admin Feedback ({selectedReport.reviewedByName || "Administrator"}):</strong>
                    <p>{selectedReport.reviewFeedback}</p>
                  </div>
                )}

                {/* Administrator Action Bar */}
                {isAdmin && (
                  <div className="admin-review-box">
                    <h4>School Administrator Review</h4>
                    <input
                      type="text"
                      placeholder="Add review feedback for teacher (optional)..."
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      className="admin-feedback-input"
                    />
                    <div className="admin-review-buttons">
                      {selectedReport.status !== "reviewed" ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleReview(selectedReport, "reviewed")}
                          className="primary-button small"
                        >
                          ✓ Mark as Reviewed
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleReview(selectedReport, "submitted")}
                          className="secondary-button small"
                        >
                          Reopen as Unreviewed
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
