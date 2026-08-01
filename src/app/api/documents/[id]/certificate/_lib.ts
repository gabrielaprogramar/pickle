import { CertificateService } from "@/lib/certificates";
import type { CertificateServiceDeps } from "@/lib/certificates";
import { CERT_MOCK_VESSEL } from "@/lib/certificates";
import { getSupabaseClient } from "@/lib/supabase";
import { createCertificateRepository } from "@/lib/supabase/repositories/certificates";
import { createDocumentRepository } from "@/lib/supabase/repositories/documents";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import {
  adaptCertificateRepository,
  createMockCertificateRepository,
} from "@/app/api/vessels/[imo]/certificates/_lib";

export interface DocumentCertificateApiDeps {
  readonly service: CertificateService;
  readonly vesselRepo: CertificateServiceDeps["vesselRepo"];
  readonly documentRepo?: { findById(id: string): Promise<{ id: string; vessel_id: string | null } | null> };
}

export function buildDefaultDocumentCertificateApiDeps(): DocumentCertificateApiDeps {
  const client = getSupabaseClient();
  const vesselRepo = createVesselRepository({ client });
  return {
    service: new CertificateService({
      certRepo: adaptCertificateRepository(createCertificateRepository({ client })),
      vesselRepo,
    }),
    vesselRepo,
    documentRepo: createDocumentRepository({ client }),
  };
}

export function buildMockDocumentCertificateApiDeps(): DocumentCertificateApiDeps {
  const vesselRepo: CertificateServiceDeps["vesselRepo"] = {
    async findByImo(imo: string) {
      if (imo !== CERT_MOCK_VESSEL.imo) return null;
      return { id: CERT_MOCK_VESSEL.vesselId, name: CERT_MOCK_VESSEL.name };
    },
  };
  return {
    service: new CertificateService({
      certRepo: createMockCertificateRepository(),
      vesselRepo,
      notify: {
        async dispatch() {
          return undefined;
        },
      },
    }),
    vesselRepo,
    documentRepo: {
      async findById(id) {
        return { id, vessel_id: CERT_MOCK_VESSEL.vesselId };
      },
    },
  };
}
