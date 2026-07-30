import type { KnowledgeDocumentRow, KnowledgeChunkRow, KnowledgeSource, KnowledgeRegulation } from "@/lib/supabase";

export interface MockKnowledgeBase {
  readonly documents: ReadonlyArray<KnowledgeDocumentRow>;
  readonly chunks: ReadonlyArray<KnowledgeChunkRow>;
  searchByKeyword(keyword: string): ReadonlyArray<KnowledgeChunkRow & { source_title: string; regulation: string }>;
  getDocument(id: string): (KnowledgeDocumentRow & { chunks: ReadonlyArray<KnowledgeChunkRow> }) | null;
  listRegulations(): ReadonlyArray<string>;
}

function mockDoc(
  id: string,
  source: KnowledgeSource,
  regulation: KnowledgeRegulation,
  title: string,
  version: string,
  content: string,
  article_section?: string | null,
  effective_date?: string | null,
): KnowledgeDocumentRow {
  return {
    id,
    source,
    regulation,
    title,
    article_section: article_section ?? null,
    effective_date: effective_date ?? null,
    version,
    content,
    metadata: {},
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };
}

function mockChunk(
  id: string,
  document_id: string,
  chunk_index: number,
  content: string,
  heading: string | null,
  article_section: string | null,
): KnowledgeChunkRow {
  return {
    id,
    document_id,
    chunk_index,
    content,
    article_section,
    heading,
    embedding: null,
    token_count: content.split(/\s+/).length,
    metadata: {},
    created_at: "2025-01-01T00:00:00.000Z",
  };
}

const EU_ETS_DOC_ID = "mock-eu-ets-001";
const FUELEU_DOC_ID = "mock-fueleu-001";
const THETIS_DOC_ID = "mock-thetis-001";
const MARPOL_DOC_ID = "mock-marpol-001";

const MOCK_DOCUMENTS: ReadonlyArray<KnowledgeDocumentRow> = [
  mockDoc(
    EU_ETS_DOC_ID,
    "eu_ets_directive",
    "EU_ETS",
    "EU Emissions Trading System Directive 2003/87/EC",
    "v1.0",
    "The EU ETS Directive establishes a cap-and-trade system for greenhouse gas emissions, including maritime transport from 2024.",
    null,
    "2024-01-01",
  ),
  mockDoc(
    FUELEU_DOC_ID,
    "fueleu_regulation",
    "FuelEU",
    "FuelEU Maritime Regulation 2023/1805",
    "v2.1",
    "FuelEU Maritime sets GHG intensity limits for energy used on board ships calling at EU ports.",
    null,
    "2025-01-01",
  ),
  mockDoc(
    THETIS_DOC_ID,
    "thetis_mrv_guidance",
    "THETIS_MRV",
    "THETIS-MRV User Guidance for MRV Reporting",
    "v3.0",
    "THETIS-MRV is the EU MRV reporting system for monitoring, reporting and verification of CO2 emissions.",
    null,
    "2025-06-01",
  ),
  mockDoc(
    MARPOL_DOC_ID,
    "marpol_annex_vi",
    "MARPOL",
    "MARPOL Annex VI Regulations for the Prevention of Air Pollution from Ships",
    "v2024",
    "MARPOL Annex VI sets limits on sulphur oxide and nitrogen oxide emissions from ship exhausts.",
    null,
    "2024-01-01",
  ),
];

const MOCK_CHUNKS: ReadonlyArray<KnowledgeChunkRow> = [
  // EU ETS chunks
  mockChunk(
    "mock-chunk-euets-1",
    EU_ETS_DOC_ID,
    0,
    "The EU ETS applies to all maritime transport emissions from voyages to, from, and between EU/EEA ports. Shipping companies are responsible for surrendering allowances covering 100% of intra-EU voyages and 50% of extra-EU voyages.",
    "Scope of Maritime Inclusion",
    "Article 3(1)",
  ),
  mockChunk(
    "mock-chunk-euets-2",
    EU_ETS_DOC_ID,
    1,
    "Companies must monitor and report their verified emissions annually. The monitoring plan must be approved by an accredited verifier and include methodology for calculating emissions per voyage.",
    "Monitoring and Reporting Obligations",
    "Article 12(2)",
  ),
  mockChunk(
    "mock-chunk-euets-3",
    EU_ETS_DOC_ID,
    2,
    "By 30 September of each year, shipping companies must surrender a number of EU Allowances (EUA) equal to their verified emissions from the previous calendar year. Failure results in penalties of EUR 100 per excess tonne of CO2.",
    "Surrender of Allowances and Penalties",
    "Article 14(1)",
  ),
  mockChunk(
    "mock-chunk-euets-4",
    EU_ETS_DOC_ID,
    3,
    "Verification must be carried out by an accredited verifier. The verified emissions report must be submitted to the administering authority by 31 March of the following year.",
    "Verification and Accreditation",
    "Article 15(1)",
  ),
  mockChunk(
    "mock-chunk-euets-5",
    EU_ETS_DOC_ID,
    4,
    "The EU ETS phases in maritime coverage gradually: 40% of verified emissions in 2024, 70% in 2025, and 100% from 2026 onwards. This phased approach allows the industry to adapt.",
    "Phase-in of Maritime Coverage",
    "Article 3(3)",
  ),

  // FuelEU chunks
  mockChunk(
    "mock-chunk-fueleu-1",
    FUELEU_DOC_ID,
    0,
    "FuelEU Maritime requires a reduction in the GHG intensity of energy used on board by 2% from 2025, 6% from 2030, 14.5% from 2035, 31% from 2040, 62% from 2045, and 80% from 2050 compared to the 2020 reference level of 91.16 gCO2e/MJ.",
    "GHG Intensity Limits",
    "Article 4(2)",
  ),
  mockChunk(
    "mock-chunk-fueleu-2",
    FUELEU_DOC_ID,
    1,
    "A compliance balance is calculated annually for each vessel. If actual GHG intensity exceeds the limit, a deficit is recorded. Deficits can be offset using surplus from previous years or through a pooling mechanism with other vessels.",
    "Compliance Balance and Pooling",
    "Article 7(1)",
  ),
  mockChunk(
    "mock-chunk-fueleu-3",
    FUELEU_DOC_ID,
    2,
    "Vessels may enter into a pooling agreement to collectively meet the GHG intensity limits. The pool's compliance balance is calculated on an aggregated basis, allowing flexibility across fleets.",
    "Pooling Mechanism",
    "Article 8(2)",
  ),
  mockChunk(
    "mock-chunk-fueleu-4",
    FUELEU_DOC_ID,
    3,
    "Non-compliance penalties are calculated as EUR 100 per GJ of energy above the limit, adjusted by the difference between actual and required GHG intensity. Repeated non-compliance may result in expulsion from EU ports.",
    "Penalties for Non-Compliance",
    "Article 23(3)",
  ),
  mockChunk(
    "mock-chunk-fueleu-5",
    FUELEU_DOC_ID,
    4,
    "The monitoring, reporting and verification (MRV) framework under FuelEU aligns with the EU MRV Regulation. Verified GHG intensity data must be submitted annually through THETIS-MRV.",
    "MRV Requirements",
    "Article 15(1)",
  ),

  // THETIS-MRV chunks
  mockChunk(
    "mock-chunk-thetis-1",
    THETIS_DOC_ID,
    0,
    "THETIS-MRV is the EU's information system for monitoring, reporting and verification of CO2 emissions from maritime transport. All ships above 5000 GT calling at EU ports must submit an emissions report annually.",
    "THETIS-MRV System Overview",
    "Section 1.1",
  ),
  mockChunk(
    "mock-chunk-thetis-2",
    THETIS_DOC_ID,
    1,
    "The emissions report must include: vessel identification, port calls, fuel consumption per fuel type, distance travelled, time at sea, and CO2 emissions. Data must be submitted by 31 March for the preceding calendar year.",
    "Reporting Requirements",
    "Section 3.2",
  ),
  mockChunk(
    "mock-chunk-thetis-3",
    THETIS_DOC_ID,
    2,
    "Verifiers check the completeness and accuracy of emissions reports. A document of compliance is issued if the report meets all requirements and is verified within the deadline.",
    "Verification Process",
    "Section 4.1",
  ),

  // MARPOL Annex VI chunks
  mockChunk(
    "mock-chunk-marpol-1",
    MARPOL_DOC_ID,
    0,
    "Under MARPOL Annex VI, the global sulphur cap is 0.50% m/m (mass by mass) for fuel oil used on board ships, effective from 1 January 2020. Within Emission Control Areas (ECAs), the limit is 0.10% m/m.",
    "Sulphur Oxide Emission Limits",
    "Regulation 14",
  ),
  mockChunk(
    "mock-chunk-marpol-2",
    MARPOL_DOC_ID,
    1,
    "NOx emissions from ship engines are regulated under MARPOL Annex VI through a tiered approach: Tier II applies globally, Tier III applies in NOx ECAs for ships constructed after 1 January 2016 or 2021 depending on the area.",
    "Nitrogen Oxide Emission Limits",
    "Regulation 13",
  ),
  mockChunk(
    "mock-chunk-marpol-3",
    MARPOL_DOC_ID,
    2,
    "Ships must carry an International Air Pollution Prevention (IAPP) Certificate, an Engine International Air Pollution Prevention (EIAPP) Certificate, and maintain an approved Ship Energy Efficiency Management Plan (SEEMP).",
    "Certification and Documentation",
    "Regulation 6",
  ),
];

export function createMockKnowledgeBase(): MockKnowledgeBase {
  function searchByKeyword(keyword: string): ReadonlyArray<KnowledgeChunkRow & { source_title: string; regulation: string }> {
    const lower = keyword.toLowerCase();
    const terms = lower.split(/\s+/).filter(Boolean);
    const docMap = new Map<string, KnowledgeDocumentRow>();
    for (const d of MOCK_DOCUMENTS) {
      docMap.set(d.id, d);
    }

    const scored: Array<{ chunk: KnowledgeChunkRow; doc: KnowledgeDocumentRow; score: number }> = [];

    for (const chunk of MOCK_CHUNKS) {
      const doc = docMap.get(chunk.document_id);
      if (!doc) continue;
      const contentLower = (chunk.content + " " + doc.title).toLowerCase();
      let matches = 0;
      for (const term of terms) {
        if (contentLower.includes(term)) {
          matches++;
        }
      }
      if (matches > 0) {
        scored.push({ chunk, doc, score: matches });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.map(({ chunk, doc, score }) => ({
      id: chunk.id,
      document_id: chunk.document_id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      article_section: chunk.article_section,
      heading: chunk.heading,
      embedding: chunk.embedding,
      token_count: chunk.token_count,
      metadata: chunk.metadata,
      created_at: chunk.created_at,
      source_title: doc.title,
      regulation: doc.regulation,
    }));
  }

  function getDocument(id: string): (KnowledgeDocumentRow & { chunks: ReadonlyArray<KnowledgeChunkRow> }) | null {
    const doc = MOCK_DOCUMENTS.find((d) => d.id === id) ?? null;
    if (!doc) return null;
    const chunks = MOCK_CHUNKS.filter((c) => c.document_id === id);
    return { ...doc, chunks };
  }

  function listRegulations(): ReadonlyArray<string> {
    const regs = new Set<string>();
    for (const d of MOCK_DOCUMENTS) {
      regs.add(d.regulation);
    }
    return Array.from(regs);
  }

  return {
    get documents() { return MOCK_DOCUMENTS; },
    get chunks() { return MOCK_CHUNKS; },
    searchByKeyword,
    getDocument,
    listRegulations,
  };
}
