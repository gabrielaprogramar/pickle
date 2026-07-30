import { apiError, apiSuccess, parseJsonBody, mapErrorResponse } from "@/app/api/_lib/http";
import { VALIDATION_ERROR, VESSEL_NOT_FOUND } from "@/app/api/_lib/errors";
import { zodIssuesToDetails } from "@/app/api/_lib/schemas";
import { resendWebhookSchema } from "./schemas";
import type { EmailIngressProvider } from "@/lib/email-ingress";
import { parseRecipient } from "@/lib/email-ingress";
import type { EmailIngestionLogRepository } from "@/lib/supabase/repositories/email_ingestion_log";
import type { VesselRepository, DocumentRepository, DocumentVersionRepository, ProcessingJobRepository, ProcessingLogRepository } from "@/lib/supabase";
import type { StorageClient } from "@/lib/storage/types";

export interface ResendWebhookDeps {
  readonly emailIngress: EmailIngressProvider;
  readonly auditLogRepo: EmailIngestionLogRepository;
  readonly vesselRepo: VesselRepository;
  readonly documentRepo: DocumentRepository;
  readonly versionRepo: DocumentVersionRepository;
  readonly jobRepo: ProcessingJobRepository;
  readonly processingLogRepo: ProcessingLogRepository;
  readonly storageClient: StorageClient;
}

export async function handleResendWebhook(
  request: Request,
  deps: ResendWebhookDeps,
): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return apiError(VALIDATION_ERROR, "Request body must be valid JSON.", 400);
    }

    const parsed = resendWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        VALIDATION_ERROR,
        "Invalid Resend webhook payload.",
        400,
        zodIssuesToDetails(parsed.error.issues),
      );
    }

    const payload = parsed.data;
    const recipient = payload.to[0];
    if (!recipient) {
      return apiError(VALIDATION_ERROR, "No recipient in email payload.", 400);
    }

    const parsedRecipient = parseRecipient(recipient);
    if (!parsedRecipient) {
      return apiError(
        VALIDATION_ERROR,
        `Invalid recipient address format: ${recipient}`,
        400,
      );
    }

    const vessel = await deps.vesselRepo.findByImo(parsedRecipient.imo);
    if (!vessel) {
      return apiError(
        VESSEL_NOT_FOUND,
        `No vessel found for IMO ${parsedRecipient.imo}`,
        404,
      );
    }

    await deps.auditLogRepo.insert({
      message_id: payload.message_id,
      sender: payload.from,
      recipient,
      subject: payload.subject ?? null,
      imo: parsedRecipient.imo,
      vessel_id: vessel.id,
      event: "EMAIL_RECEIVED",
      details: {
        attachmentCount: payload.attachments.length,
        subject: payload.subject,
      },
    });

    const emailPayload = {
      messageId: payload.message_id,
      sender: payload.from,
      recipient,
      subject: payload.subject ?? null,
      textBody: payload.text ?? null,
      htmlBody: payload.html ?? null,
      attachments: payload.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        mimeType: a.content_type,
        size: Buffer.from(a.content, "base64").length,
      })),
      receivedAt: payload.created_at,
    };

    const result = await deps.emailIngress.ingest(emailPayload);

    if (!result.accepted) {
      for (const att of result.attachments) {
        if (!att.accepted) {
          await deps.auditLogRepo.insert({
            message_id: payload.message_id,
            sender: payload.from,
            recipient,
            subject: payload.subject ?? null,
            imo: parsedRecipient.imo,
            vessel_id: vessel.id,
            event: att.rejectionReason?.includes("Duplicate") ? "DUPLICATE_DETECTED" : "ATTACHMENT_REJECTED",
            details: {
              filename: att.filename,
              sha256: att.sha256,
              reason: att.rejectionReason,
            },
          });
        }
      }

      return apiSuccess({
        messageId: payload.message_id,
        accepted: false,
        rejectionReason: result.rejectionReason,
        attachments: result.attachments.map((a) => ({
          filename: a.filename,
          accepted: a.accepted,
          rejectionReason: a.rejectionReason,
        })),
      }, 202);
    }

    for (const att of result.attachments) {
      if (!att.accepted) {
        const eventType = att.rejectionReason?.includes("Duplicate")
          ? "DUPLICATE_DETECTED"
          : "ATTACHMENT_REJECTED";
        await deps.auditLogRepo.insert({
          message_id: payload.message_id,
          sender: payload.from,
          recipient,
          subject: payload.subject ?? null,
          imo: parsedRecipient.imo,
          vessel_id: vessel.id,
          event: eventType,
          details: {
            filename: att.filename,
            sha256: att.sha256,
            reason: att.rejectionReason,
          },
        });
        continue;
      }

      await deps.auditLogRepo.insert({
        message_id: payload.message_id,
        sender: payload.from,
        recipient,
        subject: payload.subject ?? null,
        imo: parsedRecipient.imo,
        vessel_id: vessel.id,
        event: "ATTACHMENT_ACCEPTED",
        details: {
          filename: att.filename,
          sha256: att.sha256,
          storagePath: att.storagePath,
        },
      });

      const attachment = emailPayload.attachments.find(
        (a) => a.filename === att.filename,
      );
      if (!attachment) continue;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const storageKey = `email-ingest/${vessel.id}/${timestamp}_${attachment.filename}`;
      const uploadResult = await deps.storageClient.upload("documents", storageKey, attachment.content, {
        contentType: attachment.mimeType,
        metadata: {
          source: "email",
          messageId: payload.message_id,
          sha256: att.sha256,
        },
      });

      const doc = await deps.documentRepo.insert({
        vessel_id: vessel.id,
        document_type: "bdn",
        status: "uploaded",
        source_channel: "EMAIL",
        title: payload.subject ?? `BDN Email - ${attachment.filename}`,
        filename: attachment.filename,
        mime_type: attachment.mimeType,
        file_size: attachment.size,
        storage_path: uploadResult.storagePath,
        metadata: {
          source_channel: "EMAIL",
          emailMessageId: payload.message_id,
          emailSender: payload.from,
          emailRecipient: recipient,
          emailSubject: payload.subject,
          emailReceivedAt: payload.created_at,
          attachmentSha256: att.sha256,
          emailBodySnippet: payload.text?.slice(0, 500) ?? null,
        },
      });

      await deps.auditLogRepo.insert({
        message_id: payload.message_id,
        sender: payload.from,
        recipient,
        subject: payload.subject ?? null,
        imo: parsedRecipient.imo,
        vessel_id: vessel.id,
        document_id: doc.id,
        event: "DOCUMENT_CREATED",
        details: {
          documentId: doc.id,
          filename: attachment.filename,
          sha256: att.sha256,
        },
      });

      await deps.versionRepo.insert({
        document_id: doc.id,
        version_number: 1,
        filename: attachment.filename,
        storage_path: uploadResult.storagePath,
        file_size: attachment.size,
        upload_note: `Ingested via email from ${payload.from}`,
      });

      const job = await deps.jobRepo.insert({
        document_id: doc.id,
        job_type: "ocr",
        status: "pending",
      });

      await deps.processingLogRepo.insert({
        processing_job_id: job.id,
        level: "info",
        message: "Document created via email ingestion, OCR job queued",
        details: {
          documentId: doc.id,
          filename: attachment.filename,
          emailMessageId: payload.message_id,
          sourceChannel: "EMAIL",
        },
      });

      await deps.auditLogRepo.insert({
        message_id: payload.message_id,
        sender: payload.from,
        recipient,
        subject: payload.subject ?? null,
        imo: parsedRecipient.imo,
        vessel_id: vessel.id,
        document_id: doc.id,
        event: "PROCESSING_QUEUED",
        details: {
          documentId: doc.id,
          jobId: job.id,
        },
      });
    }

    return apiSuccess({
      messageId: payload.message_id,
      accepted: true,
      imo: parsedRecipient.imo,
      vesselId: vessel.id,
      totalAttachments: result.totalAttachments,
      acceptedCount: result.acceptedCount,
      rejectedCount: result.rejectedCount,
      duplicateCount: result.duplicateCount,
      attachments: result.attachments.map((a) => ({
        filename: a.filename,
        accepted: a.accepted,
        documentId: a.documentId,
        rejectionReason: a.rejectionReason,
      })),
    }, 201);
  } catch (err) {
    return mapErrorResponse(err);
  }
}
