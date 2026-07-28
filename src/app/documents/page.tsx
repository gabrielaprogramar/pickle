/**
 * documents/page.tsx — Document list page with upload form
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState } from "react";
import { useDocuments } from "@/hooks/use-documents";
import { useDocumentUpload } from "@/hooks/use-document-upload";

const DOCUMENT_TYPES = [
  { value: "imo_dcs", label: "IMO DCS" },
  { value: "eu_mrv", label: "EU MRV" },
  { value: "certificate", label: "Certificate" },
  { value: "report", label: "Report" },
  { value: "correspondence", label: "Correspondence" },
  { value: "logbook", label: "Logbook" },
  { value: "other", label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  uploaded: "#f59e0b",
  processing: "#3b82f6",
  ocr_complete: "#10b981",
  extracted: "#10b981",
  under_review: "#8b5cf6",
  approved: "#22c55e",
  rejected: "#ef4444",
  archived: "#6b7280",
};

export default function DocumentsPage() {
  const { documents, loading, error, refetch } = useDocuments();
  const { upload, uploading, error: uploadError } = useDocumentUpload();
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("certificate");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) return;

    try {
      const result = await upload({
        file: selectedFile,
        title: title.trim(),
        documentType,
      });
      setUploadSuccess(`Document uploaded successfully. ID: ${result.documentId}`);
      setTitle("");
      setSelectedFile(null);
      setShowUpload(false);
      refetch();
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch {
      // Error is captured in the hook state.
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Documents</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          style={{
            padding: "8px 16px",
            backgroundColor: showUpload ? "#6b7280" : "#1a2332",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {showUpload ? "Cancel" : "Upload Document"}
        </button>
      </div>

      {uploadSuccess && (
        <div style={{ padding: "12px", backgroundColor: "#d1fae5", color: "#065f46", borderRadius: "4px", marginBottom: "16px" }}>
          {uploadSuccess}
        </div>
      )}

      {uploadError && (
        <div style={{ padding: "12px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "4px", marginBottom: "16px" }}>
          Upload error: {uploadError}
        </div>
      )}

      {showUpload && (
        <form onSubmit={handleUpload} style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Upload New Document</h2>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "500" }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "500" }}>Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "500" }}>File</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              required
              style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedFile || !title.trim()}
            style={{
              padding: "8px 16px",
              backgroundColor: uploading ? "#9ca3af" : "#1a2332",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      )}

      {loading && <p style={{ color: "#666" }}>Loading documents...</p>}
      {error && (
        <div style={{ padding: "12px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "4px" }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <p style={{ color: "#666" }}>No documents found. Upload one to get started.</p>
      )}

      {!loading && documents.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
              <th style={{ padding: "8px" }}>Title</th>
              <th style={{ padding: "8px" }}>Type</th>
              <th style={{ padding: "8px" }}>Status</th>
              <th style={{ padding: "8px" }}>Filename</th>
              <th style={{ padding: "8px" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: "1px solid #e0e0e0" }}>
                <td style={{ padding: "8px" }}>
                  <a href={`/documents/${doc.id}`} style={{ color: "#1a73e8" }}>{doc.title}</a>
                </td>
                <td style={{ padding: "8px" }}>{doc.document_type}</td>
                <td style={{ padding: "8px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: `${STATUS_COLORS[doc.status] ?? "#6b7280"}22`,
                      color: STATUS_COLORS[doc.status] ?? "#6b7280",
                      fontSize: "13px",
                      fontWeight: "500",
                    }}
                  >
                    {doc.status}
                  </span>
                </td>
                <td style={{ padding: "8px", color: "#666" }}>{doc.filename}</td>
                <td style={{ padding: "8px", color: "#666" }}>
                  {new Date(doc.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
