import type {
  ReviewTaskRepository,
  ReviewAuditLogRepository,
  DocumentRepository,
  AiExtractionRepository,
  ValidationReportRepository,
} from "@/lib/supabase";
import type { DocumentStatus } from "@/lib/supabase/types";
import type { ReviewProvider } from "@/lib/review/types";

export interface ReviewServiceOptions {
  readonly reviewTaskRepo: ReviewTaskRepository;
  readonly auditLogRepo: ReviewAuditLogRepository;
  readonly documentRepo: DocumentRepository;
  readonly extractionRepo: AiExtractionRepository;
  readonly validationRepo: ValidationReportRepository;
  readonly reviewProvider: ReviewProvider;
}

export interface ReviewTaskFilter {
  readonly status?: string;
  readonly assignee?: string;
  readonly documentType?: string;
  readonly vesselId?: string;
}

export interface ReviewService {
  createReviewTask(documentId: string, options?: { assignee?: string; priority?: string; dueAt?: string }): Promise<{
    reviewTask: import("@/lib/supabase/types").ReviewTaskRow;
    document: import("@/lib/supabase/types").DocumentRow;
  }>;

  listReviewTasks(filter?: ReviewTaskFilter): Promise<import("@/lib/supabase/types").ReviewTaskRow[]>;

  getReviewTask(taskId: string): Promise<{
    task: import("@/lib/supabase/types").ReviewTaskRow;
    document: import("@/lib/supabase/types").DocumentRow | null;
    auditHistory: import("@/lib/supabase/types").ReviewAuditLogRow[];
  } | null>;

  getDocumentReviewTasks(documentId: string): Promise<import("@/lib/supabase/types").ReviewTaskRow[]>;

  getAuditHistory(taskId: string): Promise<import("@/lib/supabase/types").ReviewAuditLogRow[]>;

  submitDecision(
    taskId: string,
    decision: "approved" | "rejected" | "needs_changes" | "escalated",
    reviewer: string,
    notes?: string,
  ): Promise<import("@/lib/supabase/types").ReviewTaskRow>;

  approveField(taskId: string, fieldName: string, reviewer: string, comment?: string): Promise<void>;

  rejectField(taskId: string, fieldName: string, reviewer: string, reason: string): Promise<void>;

  editField(taskId: string, fieldName: string, newValue: unknown, reviewer: string, comment?: string): Promise<void>;

  markFieldUncertain(taskId: string, fieldName: string, reviewer: string, comment?: string): Promise<void>;

  addComment(taskId: string, reviewer: string, comment: string): Promise<void>;

  assignReviewer(taskId: string, assignee: string): Promise<import("@/lib/supabase/types").ReviewTaskRow>;

  getSeedData(): Promise<import("@/lib/review/types").ReviewTaskDetail[]>;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  uploaded: ["processing"],
  processing: ["ocr_complete"],
  ocr_complete: ["extracted"],
  extracted: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: ["archived"],
  rejected: ["archived"],
};

function assertValidTransition(from: string, to: string): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    throw new Error(`Invalid status transition: "${from}" → "${to}" (unknown source status)`);
  }
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition: "${from}" → "${to}". Allowed targets: ${allowed.join(", ")}`,
    );
  }
}

export function createReviewService(opts: ReviewServiceOptions): ReviewService {
  const {
    reviewTaskRepo,
    auditLogRepo,
    documentRepo,
    extractionRepo,
    validationRepo,
    reviewProvider,
  } = opts;

  return {
    async createReviewTask(documentId, options) {
      const doc = await documentRepo.findById(documentId);
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      const task = await reviewTaskRepo.insert({
        document_id: documentId,
        assigned_to: options?.assignee ?? null,
        status: options?.assignee ? "in_progress" : "pending",
        priority: (options?.priority ?? "normal") as "low" | "normal" | "high" | "urgent",
        due_at: options?.dueAt ?? null,
      });

      const updated = await documentRepo.updateStatus(documentId, "under_review" as DocumentStatus);

      await auditLogRepo.insert({
        review_task_id: task.id,
        action: "assigned",
        reviewer: "system",
        notes: `Task created for document "${doc.title}". Status: under_review.${options?.assignee ? ` Assigned to: ${options.assignee}` : ""}`,
      });

      return { reviewTask: task, document: updated };
    },

    async listReviewTasks(filter) {
      let tasks: import("@/lib/supabase/types").ReviewTaskRow[];

      if (filter?.status && filter?.status !== "all") {
        const status = filter.status as "pending" | "in_progress" | "completed" | "cancelled";
        tasks = await reviewTaskRepo.listByStatus(status);
      } else if (filter?.assignee) {
        tasks = await reviewTaskRepo.listByAssignee(filter.assignee);
      } else {
        tasks = await reviewTaskRepo.listByStatus("pending");
        const inProgress = await reviewTaskRepo.listByStatus("in_progress");
        const completed = await reviewTaskRepo.listByStatus("completed");
        tasks = [...tasks, ...inProgress, ...completed];
      }

      if (filter?.vesselId || filter?.documentType) {
        const enriched = await Promise.all(
          tasks.map(async (t) => {
            const doc = await documentRepo.findById(t.document_id);
            return { task: t, doc };
          }),
        );
        tasks = enriched
          .filter((e) => {
            if (!e.doc) return false;
            if (filter?.vesselId && e.doc.vessel_id !== filter.vesselId) return false;
            if (filter?.documentType && e.doc.document_type !== filter.documentType) return false;
            return true;
          })
          .map((e) => e.task);
      }

      return tasks;
    },

    async getReviewTask(taskId) {
      const task = await reviewTaskRepo.findById(taskId);
      if (!task) return null;

      const doc = await documentRepo.findById(task.document_id);
      const auditHistory = await auditLogRepo.listByReviewTaskId(taskId);

      return { task, document: doc, auditHistory };
    },

    async getDocumentReviewTasks(documentId) {
      return reviewTaskRepo.listByDocumentId(documentId);
    },

    async getAuditHistory(taskId) {
      return auditLogRepo.listByReviewTaskId(taskId);
    },

    async submitDecision(taskId, decision, reviewer, notes) {
      const task = await reviewTaskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Review task not found: ${taskId}`);
      }

      const doc = await documentRepo.findById(task.document_id);
      if (!doc) {
        throw new Error(`Document not found for task: ${taskId}`);
      }

      const statusTransitionMap: Record<string, DocumentStatus> = {
        approved: "approved" as DocumentStatus,
        rejected: "rejected" as DocumentStatus,
        needs_changes: "under_review" as DocumentStatus,
        escalated: "under_review" as DocumentStatus,
      };

      const targetDocStatus = statusTransitionMap[decision];
      if (!targetDocStatus) {
        throw new Error(`Unknown decision: ${decision}`);
      }

      assertValidTransition(doc.status, targetDocStatus);

      const completedTask = await reviewTaskRepo.complete(taskId, notes ?? `${decision} by ${reviewer}`);

      await documentRepo.updateStatus(task.document_id, targetDocStatus);

      await auditLogRepo.insert({
        review_task_id: taskId,
        action: decision as "approved" | "rejected" | "needs_changes" | "escalated",
        reviewer,
        notes: notes ?? null,
      });

      return completedTask;
    },

    async approveField(taskId, fieldName, reviewer, comment) {
      await auditLogRepo.insert({
        review_task_id: taskId,
        field_name: fieldName,
        action: "field_approved",
        reviewer,
        notes: comment ?? null,
      });
    },

    async rejectField(taskId, fieldName, reviewer, reason) {
      await auditLogRepo.insert({
        review_task_id: taskId,
        field_name: fieldName,
        action: "field_rejected",
        reviewer,
        notes: reason,
      });
    },

    async editField(taskId, fieldName, newValue, reviewer, comment) {
      await auditLogRepo.insert({
        review_task_id: taskId,
        field_name: fieldName,
        action: "field_edited",
        new_value: newValue,
        reviewer,
        notes: comment ?? null,
      });
    },

    async markFieldUncertain(taskId, fieldName, reviewer, comment) {
      await auditLogRepo.insert({
        review_task_id: taskId,
        field_name: fieldName,
        action: "field_uncertain",
        reviewer,
        notes: comment ?? null,
      });
    },

    async addComment(taskId, reviewer, comment) {
      await auditLogRepo.insert({
        review_task_id: taskId,
        action: "comment_added",
        reviewer,
        notes: comment,
      });
    },

    async assignReviewer(taskId, assignee) {
      const task = await reviewTaskRepo.assign(taskId, assignee);

      await auditLogRepo.insert({
        review_task_id: taskId,
        action: "assigned",
        reviewer: "system",
        notes: `Task assigned to ${assignee}`,
      });

      return task;
    },

    async getSeedData() {
      return reviewProvider.getSeedTasks();
    },
  };
}
