import { getSupabaseClient } from "@/lib/supabase/client";
import { getStorageClient } from "@/lib/storage/client";
import {
  createDocumentRepository,
  createDocumentVersionRepository,
  createProcessingJobRepository,
  createProcessingLogRepository,
  createVesselRepository,
} from "@/lib/supabase";
import { createEmailIngestionLogRepository } from "@/lib/supabase/repositories/email_ingestion_log";
import { getEmailIngressProvider } from "@/lib/email-ingress/client";
import { handleResendWebhook } from "./handler";

export async function POST(request: Request): Promise<Response> {
  const client = getSupabaseClient();

  const deps = {
    emailIngress: getEmailIngressProvider(),
    auditLogRepo: createEmailIngestionLogRepository({ client }),
    vesselRepo: createVesselRepository({ client }),
    documentRepo: createDocumentRepository({ client }),
    versionRepo: createDocumentVersionRepository({ client }),
    jobRepo: createProcessingJobRepository({ client }),
    processingLogRepo: createProcessingLogRepository({ client }),
    storageClient: getStorageClient(),
  };

  return handleResendWebhook(request, deps);
}
