import type { EmailIngestionLogInsert, EmailIngestionEvent } from "@/lib/supabase/types";

export interface AuditLogger {
  log(event: EmailIngestionLogInsert): Promise<void>;
}

export function createAuditLogger(
  repo: { insert: (input: EmailIngestionLogInsert) => Promise<unknown> },
): AuditLogger {
  return {
    async log(input: EmailIngestionLogInsert): Promise<void> {
      await repo.insert(input);
    },
  };
}
