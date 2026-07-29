export type ReviewDecision =
  | "approved"
  | "rejected"
  | "needs_changes"
  | "escalated";

export type FieldReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited"
  | "uncertain";

export type AuditAction =
  | "approved"
  | "rejected"
  | "needs_changes"
  | "escalated"
  | "field_approved"
  | "field_rejected"
  | "field_edited"
  | "field_uncertain"
  | "comment_added"
  | "assigned";

export interface FieldReview {
  readonly fieldName: string;
  readonly extractedValue: unknown;
  readonly status: FieldReviewStatus;
  readonly reviewedValue?: unknown;
  readonly confidence?: number;
  readonly warnings?: string[];
  readonly reviewer?: string;
  readonly reviewedAt?: string;
  readonly comment?: string;
}

export interface AuditEntry {
  readonly id: string;
  readonly reviewTaskId: string;
  readonly fieldName?: string;
  readonly action: AuditAction;
  readonly previousValue?: unknown;
  readonly newValue?: unknown;
  readonly reviewer: string;
  readonly notes?: string;
  readonly createdAt: string;
}

export interface ReviewTaskDetail {
  readonly task: {
    readonly id: string;
    readonly document_id: string;
    readonly assigned_to: string | null;
    readonly status: string;
    readonly priority: string;
    readonly due_at: string | null;
    readonly completed_at: string | null;
    readonly review_note: string | null;
    readonly created_at: string;
    readonly updated_at: string;
  };
  readonly document: {
    readonly id: string;
    readonly title: string;
    readonly filename: string;
    readonly document_type: string;
    readonly status: string;
    readonly vessel_id: string | null;
    readonly created_at: string;
  };
  readonly validationScore?: number;
  readonly validationStatus?: string;
  readonly readyForReview?: boolean;
  readonly aiConfidence?: number;
  readonly aiSummary?: string;
  readonly extractedFields?: Record<string, unknown>;
  readonly ocrText?: string;
  readonly fieldReviews: FieldReview[];
  readonly auditHistory: AuditEntry[];
}

export interface ReviewProvider {
  getSeedTasks(): Promise<ReviewTaskDetail[]>;
  getSeedTaskById(taskId: string): Promise<ReviewTaskDetail | null>;
}

export const REVIEW_MOCK_REVIEWERS = [
  "alice@poseidon-ledger.io",
  "bob@poseidon-ledger.io",
  "carol@poseidon-ledger.io",
] as const;
