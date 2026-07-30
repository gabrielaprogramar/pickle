# Poseidon AI Assistant — Target Architecture

> Status: Architecture design (no production code).
> Companion to: *Poseidon Ledger Product Architecture & Technical Roadmap v1.0*.
> Scope: Future AI assistant system spanning seven specialised agents over the
> existing deterministic compliance core.

---

## 0. The governing principle (read first)

Poseidon's architecture draws one hard line, stated in Section 5 of the product
spec: **compliance calculations must be deterministic**. Every assistant in this
design inherits that line as a constitutional constraint.

- **AI does:** document classification/extraction, fuel-type normalisation,
  anomaly detection, natural-language retrieval, explanation, and guidance.
- **AI never does:** compute CO₂, EUA obligations, GHG intensity, voyage
  classification, or any figure that flows into THETIS-MRV. Those come
  exclusively from the deterministic rule engines.
- **Every assistant output is advisory** with an injected disclaimer; **no
  assistant writes to the database without explicit user confirmation**, and
  every assistant action is recorded in `audit_log` with full before/after diff.
- **Multi-tenancy** is enforced by routing every tool call through an
  org-scoped gateway; assistants never touch Postgres directly and never see
  another organisation's rows (RLS as the last line of defence, org-context as
  the first).

This design treats the existing **Compliance Engine, BDN processor, AIS pipeline,
and THETIS/FuelEU export** modules as the *source of truth*, and the seven
assistants as *reading, narrating, and orchestrating* over them.

---

## 1. Shared substrate (common to all seven)

Rather than repeat the same runtime under each assistant, one platform serves
them all. Each assistant is then a configuration (system prompt + tool subset +
memory scope + model) over this substrate.

### 1.1 Agent Runtime

A single orchestration loop shared across assistants:
**perceive → route → retrieve → tool-call (loop) → guardrail → respond → audit**.
Implements function-calling, parallel tool execution, token/turn budgets,
streaming, and graceful degradation (if the LLM is down, assistants fall back to
templated deterministic answers, never silence).

### 1.2 Tool Gateway (the bright-line enforcement point)

All assistant capability is exposed as typed tools wrapping the **deterministic
services**. The gateway:

- Injects `app.current_org_id` and the caller's role before each call (RLS context).
- Classifies each tool **read-only** vs **mutating**; mutating tools
  (`draft_manual_voyage`, `queue_ais_sync`, `submit_ocr_review`,
  `create_saved_search`) always return a **confirmation draft** and only commit
  on an explicit second turn.
- Returns typed JSON; the LLM never receives raw SQL or raw row dumps — it
  receives shaped DTOs.
- Logs every invocation to `audit_log`.

### 1.3 Retrieval services (shared)

- **Regulatory KB** — `pgvector` over official EUR-Lex (Directive 2003/87/EC,
  Reg 2016/1928, Reg 2023/1805), MARPOL Annex VI, THETIS-MRV submission guide,
  FuelEU Guidance. Versioned, re-embedded quarterly, org-agnostic.
- **Structured-data tools** — typed reads over `vessels`, `voyages`,
  `fuel_deliveries`, `ets_records`, `fueleu_records`, `monitoring_plans`,
  `documents`, `ocr_jobs`, `audit_log`.
- **Reference services** — `ports`/LOCODE, port polygons, `emission_factors`,
  `green_zone_ports`, `iscc_certificates`.

### 1.4 Memory tiers

| Tier | Scope | Example | Lifetime |
|---|---|---|---|
| Ephemeral | One conversation | "the vessel we're discussing" | Session |
| Working | Org + vessel session | open violations already cited | Days |
| Long-term (entity) | Per vessel | typical routes, avg speed, usual ports, recurring BDN suppliers | Persistent |
| Long-term (knowledge) | Org-agnostic | regulatory KB, fuel synonym dictionary | Versioned |
| User | Per user | saved searches, recent queries | Persistent |

All long-term memory is multi-tenant-scoped; entity baselines feed anomaly
context but **never** feed compliance math.

### 1.5 Guardrails (cross-cutting)

- Deterministic-only for regulated figures (enforced by tool design, not by prompting).
- Mandatory source citation for any regulatory claim (doc + article/section).
- Disclaimer injection on every response.
- Confirmation-before-write for all mutating tools.
- Prompt-injection defence (structured tool outputs, no raw document text
  trusted as instruction), PII redaction, and a read-only/SQL guardrail with
  forced `LIMIT` and RLS.
- Full traceability: each turn stores prompt version, model id, tool calls,
  retrieved chunks, and final output.

### 1.6 Evaluation harness

Continuous, per-assistant metrics: regulatory-QA citation accuracy &
hallucination rate, OCR field-F1 and human-review rate, search precision@k, and
a "no-math-leak" regression test that fails if an assistant emits a computed
compliance figure instead of citing the engine. Human corrections (OCR review,
thumb ratings) feed back into prompt/dictionary improvement.

### 1.7 Model routing

One runtime, routed models: strong reasoning model (e.g. Claude Sonnet /
GPT-4-class) for **Compliance** reasoning and **OCR rescue**; cheaper/faster
models for **Captain**, **Search**, and structured extraction. Routing is
config-driven per assistant.

---

## 2. The seven assistants

---

### 2.1 Voyage Assistant

**Responsibilities**

- Explain AIS-derived voyage data in plain language (what a voyage record
  means, why it's classified intra-EU vs third-country, why
  `ets_coverage_rate` is 1.0 or 0.5).
- Diagnose and help remediate **AIS data gaps** (the Section 11.4 ladder:
  <30 min → interpolate; 30 min–6 h → flag; 6–48 h → manual entry +
  conservative estimate; >48 h → escalate).
- Explain any `VCR-01..05` voyage-consistency violation.
- Draft (never commit) **manual voyage entries** to bridge gaps, ready for
  confirmation.
- Recommend triggering an on-demand AIS sync or backfill for a date range.

**Inputs**

- `vessel_id` / IMO, date ranges, user question.
- `voyages` rows, `ais_positions` hypertable slices, `data_gap_flag`/notes.
- Port polygons + LOCODE + EU/EEA membership flag.
- Compliance Engine voyage-consistency rule outputs.

**Outputs**

- Narrative voyage explanation with confidence level.
- Gap remediation guidance keyed to the Section 11.4 ladder (with
  verifier-defensibility note).
- **Draft** manual voyage record (departure/arrival port LOCODE, times,
  distance, `ais_confidence='manual'`) requiring user confirmation.
- Suggested `POST /vessels/:id/ais-sync` action.

**Tools required**

- `get_voyage_log`, `get_ais_positions`, `get_data_gaps`, `get_port_info`,
  `explain_violation` (reads rule text), `estimate_distance` (deterministic
  Haversine helper, **advisory only** — actual stored distance is computed by
  the pipeline), `queue_ais_sync` (mutating, confirmation),
  `draft_manual_voyage` (mutating, confirmation).

**Future APIs**

- `AISProviderService` — abstraction over MarineTraffic / VesselFinder / Spire
  with a common interface (mirrors the Phase 1A `Transport` seam, extended
  multi-provider).
- `VoyageDerivationService` — expose the Phase 1 derivation algorithm (port
  detection, distance, voyage-type classification) as a queryable API.
- `PortPolygonService` — PostGIS `ST_Within` over 500+ port polygons.
- `GapEstimationService` — conservative consumption-based distance estimate
  for gaps, explicitly flagged as non-authoritative.

**Future prompts**

- *Voyage explainer* — role: fleet data analyst; must cite the voyage row
  fields; must label `ais_confidence`; must not recompute distance.
- *Gap-bridge adviser* — must classify the gap by duration using the Section
  11.4 ladder; **must never propose fabricating positions**; must offer manual
  entry as a draft and state the verifier-defensibility level.

**Memory**

- Working: voyage context for the active conversation.
- Long-term entity: per-vessel typical routes/avg speed/usual ports — used only
  to *contextualise* anomalies, never to compute compliance.

**Architecture**

- RAG-lite + tool-calling; mostly deterministic tool reads; LLM used only for
  narrative and gap-ladder reasoning. Stateless per turn beyond conversation
  memory. Output is advisory; drafts flow through the Tool Gateway's
  confirmation gate.

---

### 2.2 Compliance Assistant

*(extends the existing Section 16 assistant into a full specialised agent)*

**Responsibilities**

- Answer regulatory questions across **EU ETS, FuelEU Maritime, THETIS-MRV,
  MARPOL Annex VI** — with citations.
- Explain the **risk score** (Section 6.4) and every **open violation**
  (`VCR/FQR/MPR` rules) in plain language.
- Narrate **Monitoring Plan gap analysis** and give remediation steps.
- Explain EUA exposure, FuelEU compliance balance, and penalty exposure **by
  reading the deterministic records**, not by computing them.
- Track the compliance calendar and deadlines.

**Inputs**

- Regulatory KB chunks (pgvector) with version.
- `ets_records`, `fueleu_records`, `monitoring_plans` (+ `gap_flags`),
  compliance score, open violations.
- `emission_factors` for lookups, deadline calendar.

**Outputs**

- Cited regulatory answers (source doc + article/section).
- Risk-score breakdown narrative (data coverage %, BDN coverage %, MP currency,
  open Errors, verifier history).
- Remediation guidance per rule.
- Deadline guidance with countdown.

**Tools required**

- `regulatory_search` (pgvector, returns chunks + citation),
  `get_vessel_compliance_score`, `get_open_violations`,
  `get_fleet_ets_summary`, `get_fuel_deliveries`,
  `get_monitoring_plan_gaps`, `lookup_emission_factor`, `get_deadlines`.

**Future APIs**

- `RegulationVersioningService` — quarterly EUR-Lex refresh, diff detection, KB
  re-embedding, citation resolver (chunk → article number).
- `ComplianceEngineService` — typed API over the deterministic rule engine so
  the assistant always reads *engine output*, never re-evaluates rules.

**Future prompts**

- *Regulatory QA* — must cite source + section for every claim; must refuse
  legal advice; must append the standard disclaimer; must answer "I don't know"
  rather than guess.
- *Remediation guide* — given a rule violation, produce ordered, specific fix
  steps referencing the relevant regulation.
- *Risk-score narrator* — explain the 0–100 score and tier without ever
  re-deriving it.

**Memory**

- Org-agnostic versioned KB embeddings; per-org conversation history; per-vessel
  working context.

**Architecture**

- Classic RAG + tool-calling. Strongest guardrails of any assistant: mandatory
  citation, advisory-only, refusal of legal advice. Strong reasoning model.

---

### 2.3 Captain Assistant

**Responsibilities**

- Captain-facing (mobile/email) low-friction surface: the lightest possible
  interface to the platform.
- Confirm **Green Zone port readiness** before arrival ("you have everything
  for Antibes? here's what's missing").
- Guide BDN forwarding ("send it to
  `imo9876543@docs.poseidonledger.com`"); confirm ingest.
- Surface simplified compliance status and missing-certificate alerts.
- Answer captain questions in terse, action-oriented language.

**Inputs**

- Captain identity → assigned vessel(s).
- `green_zone_ports` requirements vs vessel document/certificate status.
- Upcoming port calls (AIS itinerary + user-entered schedule).
- Ingest confirmation events (Resend inbound).

**Outputs**

- Per-port-call readiness checklist (Green/Amber/Red) with the specific gaps.
- Ingest instructions + "BDN received & processed" confirmation.
- Terse status alerts.

**Tools required**

- `get_port_requirements`, `get_vessel_doc_status`, `get_upcoming_port_calls`,
  `get_iscc_status`, `get_ingest_confirmations`.

**Future APIs**

- `CaptainMobileAPI` — read-only, scoped to the captain's vessel, behind
  MFA-less lightweight auth.
- `PortAuthorityFeed` (Phase 3) — live requirement changes from port
  authorities.

**Future prompts**

- *Captain-facing* — terse, action-first, mobile-friendly, minimal jargon; must
  not expose compliance figures, only readiness gaps and actions.

**Memory**

- Per-captain vessel context; recent ingest confirmations; per-vessel recurring
  port list.

**Architecture**

- Thin conversational layer over deterministic reads + templated responses;
  notification-driven (hooks into the Notification System). Cheaper/faster
  model acceptable. Email-channel-aware (Resend inbound). Deliberately
  **low-capability, high-reliability** — fewer tools, more templating, lower
  hallucination risk for a non-expert audience.

---

### 2.4 Maintenance Assistant

**Responsibilities** *(compliance-relevant maintenance only — Poseidon is not a CMMS)*

- Track **class society surveys**, ISM/ISPS maintenance cycles, **ISCC
  certificate expiry**, and **Monitoring Plan review** cadence.
- Connect maintenance state to compliance impact ("this overdue annual survey
  will block your verifier sign-off").
- Recommend off-season maintenance windows around the charter calendar.

**Inputs**

- Certificate/plan expiry dates (`iscc_certificates`,
  `monitoring_plans.effective_to`).
- Class society (`vessels.class_society`), survey schedule, propulsion/equipment
  affecting emissions (scrubbers, catalytic reducers, hybrid system).
- Audit log for maintenance-relevant events.

**Outputs**

- Expiry/survey reminders (mirrors the Notification System's ISCC 30/7-day
  pattern).
- "Compliance-blocking maintenance" narratives.
- Recommended maintenance windows.

**Tools required**

- `get_certificates`, `get_plan_status`, `get_survey_schedule`,
  `get_class_society`, `get_charter_calendar`, `get_deadlines`.

**Future APIs**

- `ClassSocietyService` (Phase 3/4) — DNV/LR/RINA/BV/ABS survey-status API.
- `VesselTelemetryService` (Phase 4, Argos) — propulsion telemetry bridge for
  hybrid/electric vessels.

**Future prompts**

- *Maintenance-for-compliance* — frame every maintenance item by its compliance
  consequence and deadline; do not invent survey requirements not in the
  schedule.

**Memory**

- Per-vessel maintenance calendar; recurring survey cadence learned over cycles.

**Architecture**

- Scheduler + rule-based reminders + LLM narrative. Mostly deterministic; LLM
  only explains *why* a maintenance item matters for compliance. Requires
  modest **new tables** (survey/maintenance schedule — see §4).

---

### 2.5 Crew Assistant

**Responsibilities** *(adjacent domain — must be flagged as requiring new data)*

- Track **MLC crew obligations, ISM crew training records, crew certification
  expiry, manning requirements** that intersect compliance.
- Alert on crew-cert expiry and training gaps.
- Note: this is crew-*compliance*, not full HR/crewing.

**Inputs**

- Crew certifications, ISM training records, MLC flags, vessel manning
  requirements.

**Outputs**

- Cert-expiry alerts, training-gap flags, manning-compliance narratives.

**Tools required**

- `get_crew_certs`, `get_training_records`, `get_manning_requirements`.

**Future APIs**

- `CrewingIntegration` — future integration with external crewing systems (IDEA
  Yacht, Sealogical crew module).

**Future prompts**

- *Crew-compliance* — surface expiries and gaps against manning requirements;
  do not store or infer personal data beyond what's needed for compliance flags.

**Memory**

- Per-vessel crew roster baseline (roles/cert counts, not personal data) and
  training cadence.

**Architecture**

- Rule-based + LLM narrative. **Requires significant new schema** (crew,
  certifications, training, manning) not present in the current design — this
  is the most speculative of the seven and should be phased latest.

---

### 2.6 OCR Assistant

**Responsibilities** *(the AI core of the Section 10 pipeline — works **with** Google Document AI, not instead of it)*

- **Document classification** (BDN vs monitoring plan vs ISCC cert vs OPS
  receipt vs invoice).
- **Low-confidence field rescue** — LLM extraction for fields where Document AI
  confidence is below threshold (handwritten quantities, non-standard dates).
- **Fuel-type normalisation** — map supplier-specific descriptions to ISO 8217
  codes (the Section 10.4 step 4 logic).
- **Confidence scoring** and **review routing** via the quality gate (Section 10
  step 7).

**Inputs**

- Raw Document AI response (text + bounding boxes), document image.
- `vessels` registry (IMO cross-check), ISO 8217 fuel table,
  `emission_factors`, supplier-format memory.

**Outputs**

- `doc_type` classification + confidence.
- Structured BDN field JSON (`vessel_name`, `imo_number`, `delivery_date`,
  `port_of_delivery`, `supplier_name`, `bdn_number`, `fuel_type`,
  `quantity_mt`, `density`, `sulphur`) with **per-field confidence**.
- Normalised fuel type + category (+ `is_biofuel`, `biofuel_blend_pct`,
  `iscc_required`).
- `fields_requiring_review` and `human_review_required` flag.

**Tools required**

- `classify_document`, `extract_bdn_fields`, `normalise_fuel_type`,
  `cross_check_imo`, `lookup_emission_factor`, `quality_gate`,
  `submit_ocr_review` (mutating, confirmation).

**Future APIs**

- `DocumentAIProcessorRegistry` — versioned custom BDN processors
  (`processor_v1`, `processor_v2`), A/B routing, HITL feedback loop.
- `FuelSynonymDictionary` — managed supplier→ISO mapping that grows from human
  corrections.

**Future prompts**

- *Classification* — return one of the known `doc_type` values + confidence;
  below 0.7 → route to human.
- *Field extraction* — given bounding boxes + raw text, return strict JSON
  matching the BDN schema; never invent values not present.
- *Fuel normalisation* — map raw description → `{iso, category, blend_pct}`;
  if biofuel detected, set ISCC requirement; below 0.7 → human review.
- *Low-confidence rescue* — constrained extraction for a single failing field
  only.

**Memory**

- Per-supplier BDN template memory (learn recurring supplier layouts → improves
  extraction over time).
- Fuel synonym dictionary (grows from corrections).
- Processor-version performance metrics (drives A/B promotion).

**Architecture**

- A **pipeline**, not a chatbot: classify → extract → normalise → quality-gate.
  Document AI does the heavy lifting; the LLM handles edge cases Document AI
  misses. **This assistant is NOT merely advisory** — its output feeds
  compliance records — but extracted data passes through the deterministic
  **BDN processor → Compliance Engine → DB** path, so AI never writes a
  regulated figure directly. Human-review loop feeds back into prompts /
  dictionary (the Section 10.3 retraining loop, LLM-flavoured).

---

### 2.7 Search Assistant

**Responsibilities**

- Unified **natural-language search across all Poseidon data**: vessels,
  voyages, BDNs, documents, reports, audit log, regulations.
- Translate NL → intent → typed tool calls or **read-only, RLS-enforced** SQL
  with forced pagination.
- Examples: "all BDNs from Palma last year with confidence < 0.8", "which
  vessels have a red risk score", "find the 2024 THETIS report for SERENITY".
- Never computes; only retrieves.

**Inputs**

- NL query, org context, schema metadata, user permissions.

**Outputs**

- Ranked result cards with deep links into the app, suggested filters, saved
  searches.

**Tools required**

- `search_vessels`, `search_voyages`, `search_fuel_deliveries`,
  `search_documents`, `search_audit_log`, `search_reports`,
  `regulatory_search` (shared), `save_search` (mutating).

**Future APIs**

- `UnifiedSearchIndex` — Postgres FTS + pgvector hybrid, scoped by RLS.
- `QueryUnderstandingService` — NL → structured intent / filter AST.
- `SavedSearchService` — persistent per-user/per-org queries with subscriptions.

**Future prompts**

- *Intent router* — classify the query and pick the right tool(s).
- *NL→filter* — produce a typed filter AST against the schema; **SELECT-only,
  RLS-enforced, hard `LIMIT`, no PII leakage, no aggregations that resemble
  compliance math**.

**Memory**

- Per-user recent queries, saved searches, org-level common-query patterns.

**Architecture**

- Intent router → tool calls or a guarded SQL generator. Strictest read-only
  guardrails of any assistant. LLM for query understanding; execution fully
  deterministic. Cheaper model acceptable.

---

## 3. Orchestration & collaboration

A **supervisor/router** fronts the seven assistants. For any incoming message
it classifies intent and routes to the right specialist, with three
collaboration patterns:

1. **Single-specialist** — most requests (e.g., a regulatory question →
   Compliance).
2. **Handoff** — e.g., Captain asks "is SERENITY ready for Antibes?" → Captain
   Assistant answers readiness, but if the blocker is an overdue ISCC cert it
   hands off to Maintenance for the remediation narrative.
3. **Multi-assistant fan-out** — e.g., "prepare for verifier submission" →
   Compliance (open violations), OCR (low-confidence BDNs), Voyage (data gaps),
   Maintenance (survey currency) each report into a consolidated checklist.

The router also enforces a global rule: **if any assistant's response would
state a compliance figure, that figure must come from a deterministic tool
call** — the router blocks LLM-computed figures.

---

## 4. Schema additions required

Grounded in the existing schema, the assistant platform needs:

- `assistant_conversations` / `assistant_messages` — conversation memory +
  traceability (model, prompt version, tool calls, retrieved chunks).
- `assistant_tool_calls` — audit-grade log of every tool invocation (mirrors
  `audit_log` immutability).
- `fuel_synonyms` — supplier description → ISO 8217 mapping (feeds OCR
  Assistant).
- `survey_schedules` — class survey/ISM maintenance cycles (Maintenance
  Assistant).
- `crew_*` tables — certifications, training, manning (Crew Assistant — largest
  new surface).
- `saved_searches` — per-user persistent queries (Search Assistant).
- `ports` (PostGIS polygons) + `green_zone_ports` enrichment — already
  referenced in spec but not in the Phase 1B migration.
- `kb_documents` / `kb_chunks` (pgvector) — regulatory knowledge base with
  versioning.

---

## 5. Roadmap alignment

Mapped to the Poseidon phase plan:

- **Phase 2** → **OCR Assistant** (BDN ingest is a Phase-2 priority; highest UX
  leverage), plus the **shared substrate** (runtime, tool gateway, guardrails,
  pgvector KB).
- **Phase 3** → **Compliance Assistant** (already a Phase-3 item), **Search
  Assistant**, **Captain Assistant** (Green Zone + port-authority pilot),
  **Maintenance Assistant**.
- **Phase 4** → **Voyage Assistant** matures with Spire/Argos telemetry;
  **Crew Assistant** (latest, most speculative).

This sequencing respects the spec's engineering thesis: ship the deterministic
compliance core first, then layer AI where it multiplies the core's value —
extraction, explanation, and navigation — never substituting for it.

---

## Summary

Seven assistants over one shared, guarded runtime. They read and narrate the
deterministic engines; they never replace them. OCR and Compliance assistants
are the high-leverage early bets; Captain and Search broaden reach; Voyage,
Maintenance, and Crew deepen operational context. Every assistant is advisory,
cited, audit-logged, org-isolated, and gated behind confirmation for any write.
