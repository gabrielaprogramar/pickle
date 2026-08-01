import { CertificateService } from "@/lib/certificates";
import type { CertificateServiceDeps } from "@/lib/certificates";
import { getSupabaseClient } from "@/lib/supabase";
import { createCertificateRepository } from "@/lib/supabase/repositories/certificates";
import { adaptCertificateRepository } from "@/app/api/vessels/[imo]/certificates/_lib";

export interface CertificateByIdApiDeps {
  readonly service: CertificateService;
}

export function buildDefaultCertificateByIdApiDeps(): CertificateByIdApiDeps {
  const client = getSupabaseClient();
  const vesselRepo: CertificateServiceDeps["vesselRepo"] = {
    async findByImo() {
      return null;
    },
  };
  return {
    service: new CertificateService({
      certRepo: adaptCertificateRepository(createCertificateRepository({ client })),
      vesselRepo,
    }),
  };
}
