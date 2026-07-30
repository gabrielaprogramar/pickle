"use client";

import { useParams } from "next/navigation";
import { useDocument } from "@/hooks/use-document";
import { useDocumentValidation } from "@/hooks/use-document-validation";
import { useDocumentReview } from "@/hooks/use-document-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

const STATUS_VARIANTS: Record<string, "default" | "warning" | "success" | "destructive" | "muted" | "outline" | "secondary"> = {
  uploaded: "warning",
  processing: "secondary",
  ocr_complete: "success",
  extracted: "success",
  under_review: "outline",
  approved: "success",
  rejected: "destructive",
  archived: "muted",
  pending: "warning",
  running: "secondary",
  completed: "success",
  failed: "destructive",
  cancelled: "muted",
  unknown_document: "muted",
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 90 ? "bg-success" : pct >= 70 ? "bg-warning" : pct >= 50 ? "bg-orange-500" : "bg-destructive";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono-technical text-[11px] font-medium ${pct >= 90 ? "text-success" : pct >= 70 ? "text-warning" : "text-destructive"}`}>
        {pct}%
      </span>
    </div>
  );
}

function ValidationScoreBar({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-success" : score >= 70 ? "bg-warning" : score >= 50 ? "bg-orange-500" : "bg-destructive";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`font-mono-technical text-[11px] font-medium ${score >= 90 ? "text-success" : score >= 70 ? "text-warning" : "text-destructive"}`}>
        {score}/100
      </span>
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
  const {
    createReviewTask,
    creating: reviewCreating,
    error: reviewError,
  } = useDocumentReview(id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Loading document...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive-foreground">
        Error: {error}
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Document not found.
        </p>
      </div>
    );
  }

  const { document: documentRow, versions, jobs, ocrResults, aiExtractions, latestAiExtraction } = doc;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/documents"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft className="h-3 w-3 inline mr-1" />
          Back to Documents
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-lg font-light tracking-tight">{documentRow.title}</h1>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            {documentRow.filename}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={STATUS_VARIANTS[documentRow.status] ?? "muted"}
            className="text-[9px]"
          >
            {documentRow.status}
          </Badge>
          {latestAiExtraction && (
            <Badge
              variant={STATUS_VARIANTS[latestAiExtraction.status] ?? "muted"}
              className="text-[9px]"
            >
              AI: {latestAiExtraction.status}
            </Badge>
          )}
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
            Document Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-xs">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Type</dt>
            <dd>{documentRow.document_type}</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">MIME Type</dt>
            <dd>{documentRow.mime_type}</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Size</dt>
            <dd>{documentRow.file_size ? `${(documentRow.file_size / 1024).toFixed(1)} KB` : "N/A"}</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Created</dt>
            <dd className="font-mono-technical tabular-nums">{new Date(documentRow.created_at).toLocaleString()}</dd>
            {documentRow.vessel_id && (
              <>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Vessel ID</dt>
                <dd className="font-mono-technical tabular-nums">{documentRow.vessel_id}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {latestAiExtraction && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
                AI Extraction
              </CardTitle>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {latestAiExtraction.provider} / {latestAiExtraction.model}
                {latestAiExtraction.latency_ms !== null && (
                  <> — {(latestAiExtraction.latency_ms / 1000).toFixed(1)}s</>
                )}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestAiExtraction.confidence !== null && (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mr-2">
                  Confidence
                </span>
                <ConfidenceBar confidence={latestAiExtraction.confidence} />
              </div>
            )}

            {latestAiExtraction.summary && (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Summary</span>
                <p className="mt-1 text-xs leading-relaxed">{latestAiExtraction.summary}</p>
              </div>
            )}

            {Object.keys(latestAiExtraction.fields).length > 0 && (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Extracted Fields</span>
                <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-auto max-h-72 font-mono-technical">
                  {JSON.stringify(latestAiExtraction.fields, null, 2)}
                </pre>
              </div>
            )}

            {latestAiExtraction.warnings.length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-warning-foreground">Warnings</span>
                <ul className="mt-1 space-y-0.5 text-xs text-warning-foreground list-disc list-inside">
                  {latestAiExtraction.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {latestAiExtraction.missing_fields.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-destructive-foreground">Missing Fields</span>
                <ul className="mt-1 space-y-0.5 text-xs text-destructive-foreground list-disc list-inside">
                  {latestAiExtraction.missing_fields.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {latestAiExtraction.error_message && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-destructive-foreground">Error</span>
                <p className="mt-1 text-xs text-destructive-foreground">{latestAiExtraction.error_message}</p>
              </div>
            )}

            {latestAiExtraction.total_tokens !== null && (
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Tokens: {latestAiExtraction.prompt_tokens} prompt + {latestAiExtraction.completion_tokens} completion = {latestAiExtraction.total_tokens} total
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!latestAiExtraction && (
        <Card className="mb-4">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-3">
              No AI extraction yet.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => { void triggerExtraction(); }}
              disabled={extracting}
            >
              {extracting ? "Extracting..." : "Run AI Extraction"}
            </Button>
            {extractionError && (
              <p className="mt-2 text-xs text-destructive">{extractionError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {(documentRow.status === "extracted" || documentRow.status === "under_review" || documentRow.status === "approved" || documentRow.status === "rejected") && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Human Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documentRow.status === "extracted" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Send this document for human review to validate AI-extracted information.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => { void createReviewTask(); }}
                  disabled={reviewCreating}
                >
                  {reviewCreating ? "Creating..." : "Send for Review"}
                </Button>
              </div>
            )}
            {(documentRow.status === "under_review" || documentRow.status === "approved" || documentRow.status === "rejected") && (
              <Link
                href="/review"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-7 px-3"
              >
                {documentRow.status === "approved" ? "View Review (Approved)" :
                 documentRow.status === "rejected" ? "View Review (Rejected)" :
                 "View Review Task"}
              </Link>
            )}
            {reviewError && (
              <p className="mt-2 text-xs text-destructive">{reviewError}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Validation
            </CardTitle>
            {validation && (
              <Badge
                variant={validation.ready_for_review ? "success" : "destructive"}
                className="text-[9px]"
              >
                {validation.ready_for_review ? "Ready for Review" : "Needs Review"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {validationLoading && (
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Loading validation...
            </p>
          )}

          {!validationLoading && !validation && !validationDetail && (
            <div className="flex flex-col items-center py-4 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-3">
                No validation report yet.
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => { void triggerValidation(); }}
                disabled={validating}
              >
                {validating ? "Validating..." : "Run Validation"}
              </Button>
              {validationError && (
                <p className="mt-2 text-xs text-destructive">{validationError}</p>
              )}
            </div>
          )}

          {(validation || validationDetail) && (
            <div className="space-y-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mr-2">
                  Validation Score
                </span>
                <ValidationScoreBar score={validation?.score ?? validationDetail?.persisted.score ?? 0} />
              </div>

              <div className="flex gap-4 text-xs">
                <span className="text-success">
                  Passed: {validation?.passed_count ?? validationDetail?.persisted.passed_count ?? 0}
                </span>
                {(validation?.warning_count ?? validationDetail?.persisted.warning_count ?? 0) > 0 && (
                  <span className="text-warning">
                    Warnings: {validation?.warning_count ?? validationDetail?.persisted.warning_count ?? 0}
                  </span>
                )}
                {(validation?.error_count ?? validationDetail?.persisted.error_count ?? 0) > 0 && (
                  <span className="text-destructive">
                    Errors: {validation?.error_count ?? validationDetail?.persisted.error_count ?? 0}
                  </span>
                )}
              </div>

              {(validation?.blocking_issues ?? validationDetail?.report.blockingIssues ?? []).length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-destructive-foreground">Blocking Issues</span>
                  <ul className="mt-1 space-y-0.5 text-xs text-destructive-foreground list-disc list-inside">
                    {(validation?.blocking_issues ?? validationDetail?.report.blockingIssues ?? []).map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(validation?.recommended_review ?? validationDetail?.report.recommendedReview ?? []).length > 0 && (
                <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-warning-foreground">Recommended Review</span>
                  <ul className="mt-1 space-y-0.5 text-xs text-warning-foreground list-disc list-inside">
                    {(validation?.recommended_review ?? validationDetail?.report.recommendedReview ?? []).map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { void triggerValidation(); }}
                  disabled={validating}
                >
                  {validating ? "Validating..." : "Re-run Validation"}
                </Button>
                {validationError && (
                  <p className="mt-2 text-xs text-destructive">{validationError}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Processing Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.job_type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANTS[job.status] ?? "muted"}
                        className="text-[9px]"
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono-technical text-[11px] text-muted-foreground tabular-nums">
                      {job.started_at ? new Date(job.started_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="font-mono-technical text-[11px] text-muted-foreground tabular-nums">
                      {job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="font-mono-technical text-[11px] text-destructive">
                      {job.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {ocrResults.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              OCR Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ocrResults.map((ocr) => (
              <div key={ocr.id}>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                  Confidence: {ocr.confidence !== null ? `${(ocr.confidence * 100).toFixed(1)}%` : "N/A"}
                </p>
                {ocr.extracted_data && Object.keys(ocr.extracted_data).length > 0 && (
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-72 font-mono-technical">
                    {JSON.stringify(ocr.extracted_data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {versions.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              Versions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono-technical tabular-nums">v{v.version_number}</TableCell>
                    <TableCell>{v.filename}</TableCell>
                    <TableCell className="font-mono-technical text-[11px] text-muted-foreground tabular-nums">
                      {new Date(v.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
