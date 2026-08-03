"use client";

import { useState } from "react";
import { useDocuments } from "@/hooks/use-documents";
import { useDocumentUpload } from "@/hooks/use-document-upload";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "imo_dcs", label: "IMO DCS" },
  { value: "eu_mrv", label: "EU MRV" },
  { value: "certificate", label: "Certificate" },
  { value: "report", label: "Report" },
  { value: "correspondence", label: "Correspondence" },
  { value: "logbook", label: "Logbook" },
  { value: "other", label: "Other" },
];

const STATUS_VARIANTS: Record<string, "default" | "warning" | "success" | "destructive" | "muted" | "outline" | "secondary"> = {
  uploaded: "warning",
  processing: "secondary",
  ocr_complete: "success",
  extracted: "success",
  under_review: "outline",
  approved: "success",
  rejected: "destructive",
  archived: "muted",
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
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="mb-2 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <span className="block h-px w-7 bg-primary" aria-hidden="true" />
            Document Management
          </p>
          <h1 className="font-serif text-lg font-light tracking-tight">Documents</h1>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Document management and processing
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowUpload(!showUpload)}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {showUpload ? "Cancel" : "Upload Document"}
        </Button>
      </div>

      {uploadSuccess && (
        <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-xs text-success-foreground">
          {uploadSuccess}
        </div>
      )}

      {uploadError && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive-foreground">
          Upload error: {uploadError}
        </div>
      )}

      {showUpload && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Upload New Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-3">
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  Title
                </label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Document title"
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  File
                </label>
                <Input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  required
                  className="w-full"
                />
              </div>

              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={uploading || !selectedFile || !title.trim()}
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Loading documents...
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorBanner
            message={error}
            code="LOAD_ERROR"
            onRetry={refetch}
          />
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No documents found"
          description="Upload a document to get started."
        />
      )}

      {!loading && documents.length > 0 && (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      {doc.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.document_type}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANTS[doc.status] ?? "muted"}
                      className="text-[9px]"
                    >
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono-technical text-[11px] text-muted-foreground">
                    {doc.filename}
                  </TableCell>
                  <TableCell className="font-mono-technical text-[11px] text-muted-foreground tabular-nums">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
