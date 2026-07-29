/**
 * documents/[id]/page.tsx — Document detail page with AI extraction display
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useParams } from "next/navigation";
import { useDocument } from "@/hooks/use-document";
import { useDocumentValidation } from "@/hooks/use-document-validation";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "#f59e0b",
  processing: "#3b82f6",
  ocr_complete: "#10b981",
  extracted: "#10b981",
  under_review: "#8b5cf6",
  approved: "#22c55e",
  rejected: "#ef4444",
  archived: "#6b7280",
  pending: "#f59e0b",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  cancelled: "#6b7280",
  unknown_document: "#6b7280",
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 90 ? "#10b981" : pct >= 70 ? "#f59e0b" : pct >= 50 ? "#f97316" : "#ef4444";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div
        style={{
          flex: 1,
          height: "8px",
          backgroundColor: "#e5e7eb",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: "4px",
          }}
        />
      </div>
      <span style={{ fontSize: "13px", fontWeight: "500", color }}>{pct}%</span>
    </div>
  );
}

function ValidationScoreBar({ score }: { score: number }) {
  const color =
    score >= 90 ? "#10b981" : score >= 70 ? "#f59e0b" : score >= 50 ? "#f97316" : "#ef4444";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div
        style={{
          flex: 1,
          height: "8px",
          backgroundColor: "#e5e7eb",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: "4px",
          }}
        />
      </div>
      <span style={{ fontSize: "13px", fontWeight: "500", color }}>{score}/100</span>
    </div>
  );
}

export default function DocumentDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : null;
  const {
    document: doc,
    loading,
    error,
    triggerExtraction,
    extracting,
    extractionError,
  } = useDocument(id);
  const {
    validation,
    loading: validationLoading,
    triggerValidation,
    validating,
    validationError,
    validationDetail,
  } = useDocumentValidation(id);

  if (loading) {
    return <p style={{ color: "#666" }}>Loading document...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: "12px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "4px" }}>
        Error: {error}
      </div>
    );
  }

  if (!doc) {
    return <p style={{ color: "#666" }}>Document not found.</p>;
  }

  const { document: documentRow, versions, jobs, ocrResults, aiExtractions, latestAiExtraction } = doc;

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <a href="/documents" style={{ color: "#1a73e8", fontSize: "14px" }}>← Back to Documents</a>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "4px" }}>{documentRow.title}</h1>
          <p style={{ color: "#666", fontSize: "14px" }}>{documentRow.filename}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "4px",
              backgroundColor: `${STATUS_COLORS[documentRow.status] ?? "#6b7280"}22`,
              color: STATUS_COLORS[documentRow.status] ?? "#6b7280",
              fontWeight: "500",
            }}
          >
            {documentRow.status}
          </span>
          {latestAiExtraction && (
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "4px",
                backgroundColor: `${STATUS_COLORS[latestAiExtraction.status] ?? "#6b7280"}22`,
                color: STATUS_COLORS[latestAiExtraction.status] ?? "#6b7280",
                fontWeight: "500",
              }}
            >
              AI: {latestAiExtraction.status}
            </span>
          )}
        </div>
      </div>

      {/* Document Info */}
      <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Document Info</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px", fontSize: "14px" }}>
          <dt style={{ fontWeight: "500", color: "#666" }}>Type</dt>
          <dd>{documentRow.document_type}</dd>
          <dt style={{ fontWeight: "500", color: "#666" }}>MIME Type</dt>
          <dd>{documentRow.mime_type}</dd>
          <dt style={{ fontWeight: "500", color: "#666" }}>Size</dt>
          <dd>{documentRow.file_size ? `${(documentRow.file_size / 1024).toFixed(1)} KB` : "N/A"}</dd>
          <dt style={{ fontWeight: "500", color: "#666" }}>Created</dt>
          <dd>{new Date(documentRow.created_at).toLocaleString()}</dd>
          {documentRow.vessel_id && (
            <>
              <dt style={{ fontWeight: "500", color: "#666" }}>Vessel ID</dt>
              <dd>{documentRow.vessel_id}</dd>
            </>
          )}
        </dl>
      </section>

      {/* AI Extraction */}
      {latestAiExtraction && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 style={{ fontSize: "18px" }}>AI Extraction</h2>
            <span style={{ fontSize: "12px", color: "#666" }}>
              {latestAiExtraction.provider} / {latestAiExtraction.model}
              {latestAiExtraction.latency_ms !== null && (
                <> — {(latestAiExtraction.latency_ms / 1000).toFixed(1)}s</>
              )}
            </span>
          </div>

          {/* Confidence */}
          {latestAiExtraction.confidence !== null && (
            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", color: "#666", marginRight: "8px" }}>Confidence:</span>
              <ConfidenceBar confidence={latestAiExtraction.confidence} />
            </div>
          )}

          {/* Summary */}
          {latestAiExtraction.summary && (
            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#666" }}>Summary</span>
              <p style={{ fontSize: "14px", marginTop: "4px", lineHeight: "1.5" }}>{latestAiExtraction.summary}</p>
            </div>
          )}

          {/* Extracted Fields */}
          {Object.keys(latestAiExtraction.fields).length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#666" }}>Extracted Fields</span>
              <pre style={{
                backgroundColor: "#f5f5f5",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "13px",
                overflow: "auto",
                maxHeight: "300px",
                marginTop: "4px",
              }}>
                {JSON.stringify(latestAiExtraction.fields, null, 2)}
              </pre>
            </div>
          )}

          {/* Warnings */}
          {latestAiExtraction.warnings.length > 0 && (
            <div style={{ marginBottom: "12px", padding: "10px", backgroundColor: "#fffbeb", borderRadius: "4px", border: "1px solid #fde68a" }}>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#92400e" }}>Warnings</span>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "13px", color: "#92400e" }}>
                {latestAiExtraction.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing Fields */}
          {latestAiExtraction.missing_fields.length > 0 && (
            <div style={{ marginBottom: "12px", padding: "10px", backgroundColor: "#fef2f2", borderRadius: "4px", border: "1px solid #fecaca" }}>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#991b1b" }}>Missing Fields</span>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "13px", color: "#991b1b" }}>
                {latestAiExtraction.missing_fields.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Error */}
          {latestAiExtraction.error_message && (
            <div style={{ padding: "10px", backgroundColor: "#fef2f2", borderRadius: "4px", border: "1px solid #fecaca" }}>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#991b1b" }}>Error</span>
              <p style={{ fontSize: "13px", color: "#991b1b", margin: "4px 0 0 0" }}>{latestAiExtraction.error_message}</p>
            </div>
          )}

          {/* Token Usage */}
          {latestAiExtraction.total_tokens !== null && (
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
              Tokens: {latestAiExtraction.prompt_tokens} prompt + {latestAiExtraction.completion_tokens} completion = {latestAiExtraction.total_tokens} total
            </div>
          )}
        </section>
      )}

      {/* Trigger Extraction Button */}
      {!latestAiExtraction && (
        <section style={{ border: "1px dashed #d1d5db", borderRadius: "8px", padding: "20px", marginBottom: "16px", textAlign: "center" }}>
          <p style={{ color: "#666", fontSize: "14px", marginBottom: "12px" }}>No AI extraction yet.</p>
          <button
            onClick={() => { void triggerExtraction(); }}
            disabled={extracting}
            style={{
              padding: "8px 20px",
              borderRadius: "6px",
              backgroundColor: extracting ? "#93c5fd" : "#2563eb",
              color: "#fff",
              border: "none",
              fontSize: "14px",
              fontWeight: "500",
              cursor: extracting ? "not-allowed" : "pointer",
            }}
          >
            {extracting ? "Extracting..." : "Run AI Extraction"}
          </button>
          {extractionError && (
            <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px" }}>{extractionError}</p>
          )}
        </section>
      )}

      {/* Validation */}
      <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "18px" }}>Validation</h2>
          {validation && (
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "4px",
                fontWeight: "500",
                fontSize: "13px",
                backgroundColor: validation.ready_for_review ? "#dcfce7" : "#fef2f2",
                color: validation.ready_for_review ? "#166534" : "#991b1b",
              }}
            >
              {validation.ready_for_review ? "Ready for Review" : "Needs Review"}
            </span>
          )}
        </div>

        {validationLoading && (
          <p style={{ color: "#666", fontSize: "14px" }}>Loading validation...</p>
        )}

        {!validationLoading && !validation && !validationDetail && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "12px" }}>
              No validation report yet. Run validation to check extraction quality.
            </p>
            <button
              onClick={() => { void triggerValidation(); }}
              disabled={validating}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                backgroundColor: validating ? "#93c5fd" : "#2563eb",
                color: "#fff",
                border: "none",
                fontSize: "14px",
                fontWeight: "500",
                cursor: validating ? "not-allowed" : "pointer",
              }}
            >
              {validating ? "Validating..." : "Run Validation"}
            </button>
            {validationError && (
              <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px" }}>{validationError}</p>
            )}
          </div>
        )}

        {(validation || validationDetail) && (
          <div>
            {/* Score */}
            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", color: "#666", marginRight: "8px" }}>Validation Score:</span>
              <ValidationScoreBar score={validation?.score ?? validationDetail?.persisted.score ?? 0} />
            </div>

            {/* Summary counts */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", color: "#166534" }}>
                Passed: {validation?.passed_count ?? validationDetail?.persisted.passed_count ?? 0}
              </div>
              {(validation?.warning_count ?? validationDetail?.persisted.warning_count ?? 0) > 0 && (
                <div style={{ fontSize: "13px", color: "#92400e" }}>
                  Warnings: {validation?.warning_count ?? validationDetail?.persisted.warning_count ?? 0}
                </div>
              )}
              {(validation?.error_count ?? validationDetail?.persisted.error_count ?? 0) > 0 && (
                <div style={{ fontSize: "13px", color: "#991b1b" }}>
                  Errors: {validation?.error_count ?? validationDetail?.persisted.error_count ?? 0}
                </div>
              )}
            </div>

            {/* Blocking Issues */}
            {(validation?.blocking_issues ?? validationDetail?.report.blockingIssues ?? []).length > 0 && (
              <div style={{ marginBottom: "12px", padding: "10px", backgroundColor: "#fef2f2", borderRadius: "4px", border: "1px solid #fecaca" }}>
                <span style={{ fontSize: "13px", fontWeight: "500", color: "#991b1b" }}>Blocking Issues</span>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "13px", color: "#991b1b" }}>
                  {(validation?.blocking_issues ?? validationDetail?.report.blockingIssues ?? []).map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Review */}
            {(validation?.recommended_review ?? validationDetail?.report.recommendedReview ?? []).length > 0 && (
              <div style={{ marginBottom: "12px", padding: "10px", backgroundColor: "#fffbeb", borderRadius: "4px", border: "1px solid #fde68a" }}>
                <span style={{ fontSize: "13px", fontWeight: "500", color: "#92400e" }}>Recommended Review</span>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "13px", color: "#92400e" }}>
                  {(validation?.recommended_review ?? validationDetail?.report.recommendedReview ?? []).map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Re-run button */}
            <div style={{ marginTop: "12px" }}>
              <button
                onClick={() => { void triggerValidation(); }}
                disabled={validating}
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  backgroundColor: validating ? "#e5e7eb" : "#f3f4f6",
                  color: validating ? "#9ca3af" : "#374151",
                  border: "1px solid #d1d5db",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: validating ? "not-allowed" : "pointer",
                }}
              >
                {validating ? "Validating..." : "Re-run Validation"}
              </button>
              {validationError && (
                <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px" }}>{validationError}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Processing Jobs */}
      {jobs.length > 0 && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Processing Jobs</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e0e0e0" }}>
                <th style={{ padding: "6px", textAlign: "left" }}>Job Type</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Status</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Started</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Completed</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "6px" }}>{job.job_type}</td>
                  <td style={{ padding: "6px" }}>
                    <span style={{ color: STATUS_COLORS[job.status] ?? "#6b7280" }}>{job.status}</span>
                  </td>
                  <td style={{ padding: "6px", color: "#666" }}>
                    {job.started_at ? new Date(job.started_at).toLocaleString() : "—"}
                  </td>
                  <td style={{ padding: "6px", color: "#666" }}>
                    {job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}
                  </td>
                  <td style={{ padding: "6px", color: "#ef4444" }}>
                    {job.error_message ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* OCR Results */}
      {ocrResults.length > 0 && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>OCR Results</h2>
          {ocrResults.map((ocr) => (
            <div key={ocr.id} style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>
                Confidence: {ocr.confidence !== null ? `${(ocr.confidence * 100).toFixed(1)}%` : "N/A"}
              </p>
              {ocr.extracted_data && Object.keys(ocr.extracted_data).length > 0 && (
                <pre style={{
                  backgroundColor: "#f5f5f5",
                  padding: "12px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  overflow: "auto",
                  maxHeight: "300px",
                }}>
                  {JSON.stringify(ocr.extracted_data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Versions */}
      {versions.length > 0 && (
        <section style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Versions</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e0e0e0" }}>
                <th style={{ padding: "6px", textAlign: "left" }}>Version</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Filename</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "6px" }}>v{v.version_number}</td>
                  <td style={{ padding: "6px" }}>{v.filename}</td>
                  <td style={{ padding: "6px", color: "#666" }}>
                    {new Date(v.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
