# FITVOYAGES × POSEIDON LEDGER — MEETING BRIEF

**Version:** 1.0
**Date prepared:** 30 August 2026
**Prepared for:** Gabriel (Poseidon Ledger founder)
**Meeting type:** Introductory technical / partnership discovery
**Not a legal document.** Regulatory figures are as implemented in Poseidon's codebase and verified where indicated; anything not verified is labelled `[VERIFY]`.

---

## 1. EXECUTIVE SUMMARY

Poseidon Ledger is a **maritime emissions compliance system of record** for EU ETS Maritime, FuelEU Maritime, and THETIS-MRV reporting — built for Mediterranean superyachts and the yacht-management companies that operate them. It is a full-stack Next.js app with **deterministic, unit-tested compliance engines** for EU ETS, FuelEU, EU MRV/THETIS, Med SOx ECA, and certificates, backed by a Supabase schema (50 tables, 17 migrations) and ~109 API endpoints. It is mock-first and demo-ready.

FitVoyages is an **earlier-stage, AI-branded vessel-performance-monitoring SaaS** for offshore operations (OSV / offshore energy), white-label, based in Dubai, founded 2024, ~3 staff. Its market position relies on **clamp-on ultrasonic fuel-flow sensors** + a "specialized offshore dashboard" mapping real-time mass flow against shaft power. It claims one marquee reference: **P&O Maritime Logistics** (DP World's offshore arm). Its own marketing claims "environmental compliance / meet IMO standards / emissions tracking" but shows **no EU ETS / FuelEU / THETIS-MRV-specific capability** anywhere public.

**The core commercial opportunity:** FitVoyages sits *upstream* of the compliance problem — they measure and validate fuel/engine/voyage data, the exact operational input Poseidon needs. Poseidon sits *downstream* — it turns operational data into a regulator-ready, audit-defensible compliance record. The two layers are complementary, not competing. The realistic near-term shape is an **API/data-feed handoff** plus a **referral relationship**, anchored on a real client use case.

**The single most important finding for this meeting:** Delstin Kuriakose (named in the playbooks as "founder") is in fact **Global Sales Manager** — a commercial/sales profile with only ~3 months in maritime, based in Dubai. `[SOURCE]` — https://ae.linkedin.com/in/delstin-kuriakose (accessed 30 Aug 2026). This changes the read of the room: the "technical ops" and "engineering/product" attendees (Mira, Theo) are the people who will actually pressure-test the integration. Note the playbooks may be partially hypothetical; verify who is actually attending. `[VERIFY]`

---

## 2. MEETING OBJECTIVE

**Primary:** Determine whether there is real technical AND commercial overlap between FitVoyages' validated operational data and Poseidon's compliance layer, and leave with one concrete, low-commitment next step.

**Success states (pick one):**
- **A.** A real customer/use case (ideally Greece-based) for a one-vessel pilot.
- **B.** A technical data/API mapping exercise between the two engineering teams.
- **C.** A follow-up technical session with both technical teams on data format.

**The ideal outcome:** "Let's take one real customer and one vessel and map FitVoyages' data into Poseidon."

**What success is NOT:** leaving the call with a vague "let's stay in touch," or a signed agreement (premature for a first meeting).

---

## 3. PEOPLE

> **Important caveat:** The playbooks name Delstin (founder), Mira (technical ops), Theo (engineering/product). Public research confirms Delstin's role but found no public record of "Mira" or "Theo." Treat Mira/Theo detail as `[INFERENCE]` from the playbook descriptions and `[VERIFY]` names/roles in the room.

### 3.1 Delstin Kuriakose — Global Sales Manager, Fit Voyages
- **Role:** Global Sales Manager (joined Fit Voyages ~June 2026). `[SOURCE]` LinkedIn
- **Location/profile:** Dubai, UAE. Prior roles: Account Manager + Customer Support Executive at SalesOne; Customer Support Executive at JIITAK Inc. ~3 years total professional experience; ~3 months into maritime (`[SOURCE]` — multiple Delstin LinkedIn posts, e.g. "Three months into maritime... I walked in with a wrong assumption," Aug 5 2026).
- **Commercial orientation:** Selling B2B, white-label, "AI-powered" platform; posts on offshore fuel data, EU ETS 2027 deadline for OSVs ≥5000 GT, sensor-to-dashboard stories. Clearly understands the *commercial* angle of EU ETS and is position-building around it.
- **Likely priorities `[INFERENCE]`:** Win deals, build credible partner network, avoid being embarrassed on technical specifics. Will care about: does partnering expand what FitVoyages can sell, is Poseidon real, does Poseidon compete for their customers.
- **Likely questions `[INFERENCE]`:** What's the commercial model? Will you go direct to our customers? Is this a referral? How does a client pay?
- **Likely objections `[INFERENCE]`:** Scope of a first deal, "why not build this ourselves," speed.

### 3.2 Mira — Technical Operations (per playbook)
- **Likely profile `[INFERENCE]`:** Operational/technical — cares about whether Poseidon plugs into how client data *already moves*, onboarding friction, support load, data governance.
- **Likely questions `[INFERENCE]`:** What data do you actually need? What frequency? Does this add work to our onboarding? Who handles a data dispute? Where is data hosted / who owns it?
- **Likely objection `[INFERENCE]`:** "This adds integration complexity for our sales motion."

### 3.3 Theo — Engineering / Product (per playbook)
- **Likely profile `[INFERENCE]`:** The one most likely silently scoping **build-vs-buy**. Will probe how *hard* the compliance logic really is and how *mature* Poseidon's system is vs its pitch.
- **Likely questions `[INFERENCE]`:** Do you have an API today? What format? How do you version calculations? What's your system architecture? Why couldn't we build this?
- **Likely objection `[INFERENCE]`:** "The regulatory mechanics are public; we could build this."

### 3.4 Not likely in the room but relevant
- **Aswin Anand PA** — Co-Founder of Fit Voyages (`[SOURCE]` LinkedIn), also Co-Founder/Director of Qubicle Innovations (IT services). Software engineering / IT services background, not a marine engineer. This matters: the technical build is likely outsourced/small. `[INFERENCE]`
- **Ashila Anil** — VP of Global Business Development (`[SOURCE]` LinkedIn), sales profile, Mumbai-based.

---

## 4. CONVERSATION HISTORY

There is **no external conversation history** beyond the three internal preparation documents in `docs/CALL`. No prior Poseidon↔FitVoyages interaction is documented. The three files represent **rehearsal material**, likely based on an upcoming first meeting.

### 4.1 Document inventory
| File | Role | Key content |
|---|---|---|
| `FitVoyages x Poseidon Ledger - Meeting Playbook.docx` | Rehearsal guide | Meeting context, position, timeline, 15 Q&A, questions to ask, technical scenarios, red flags, whiteboard, closing |
| `Poseidon Ledger x FitVoyages - Live Meeting Simulation.docx` | Performance manual | Room psychology, 42 predicted questions, 50 "experienced operator" sentences, steering tactics, closing |
| `poseidon-fitvoyages-meeting-playbook.docx` | Founder prep | FitVoyages profile, meeting psychology, 6-phase flow, "if they ask" table, phrases, 2-min/technical/commercial explanations |

### 4.2 What the documents imply was established (all internal, before the meeting)
- No prior relationship. This is a **first meeting** `[SOURCE - playbook]`.
- FitVoyages' attendee composition (founder + 2 technical) is read as a **technical feasibility evaluation**, not a courtesy call.
- Poseidon's positioning is fixed: compliance system of record, downstream of operational data, EU ETS/FuelEU/THETIS-MRV, Mediterranean superyachts.
- The "why didn't we build this ourselves," "will you go direct to our customers," and "how mature is your product" questions are expected and prepared for.

### 4.3 Timeline
| Date | Event |
|---|---|
| (pre-2025) | FitVoyages founded (2024), white-label OSV monitoring platform |
| Dec 2025 | P&O Maritime Logistics announces *separate* IoT partnership with **Onboard** (`[SOURCE]` smartmaritimenetwork.com) — note: not FitVoyages. FitVoyages' own site lists P&O as a client logo. `[VERIFY]` whether FitVoyages reference is marketing or real contract |
| Jun 2026 | Delstin joins as Global Sales Manager; Ashila joins as VP Bus Dev; FitVoyages announces P&O "partnership" (LinkedIn) |
| Jul 2026 | Delstin's EU ETS 2027-deadline and fuel-data posts |
| ~Aug 2026 | Poseidon prepares this first meeting (3 playbooks produced) |
| **Today (30 Aug 2026)** | **This meeting (planned)** |

**Contradiction to note `[CONTRADICTION]`:** The playbooks describe Delstin as **Founder**; public LinkedIn research describes Delstin as **Global Sales Manager** with ~3 months' maritime experience. This materially changes who is in the room and what they care about. Verify on the call. Do not silently assume the playbook is authoritative.

---

## 5. FITVOYAGES RESEARCH

### 5.1 Company
- **Registered product name:** FitVoyages / Fit Voyages. Founded 2024, HQ Dubai, UAE. `[SOURCE]` fitvoyages.co, LinkedIn company page.
- **Size:** ~3 employees (per LinkedIn "Exa" data; Indian-based `[INFERENCE]`), 11-50 on one profile. Contradictory figures — `[VERIFY]`.
- **Build:** Website is WordPress/Elementor (`[SOURCE]` — WP paths in site assets), a young company. Founder Aswin Anand runs Qubicle Innovations (IT services) — FitVoyages likely built/co-delivered through Qubicle. `[INFERENCE]`
- **Positioning:** "White-label" — clients run the platform under their own brand. "Your Brand. Your Platform. Your Success." `[SOURCE]` fitvoyages.co
- **Claimed reference client:** P&O Maritime Logistics (DP World's offshore energy arm). Note P&O signed a *separate, concurrent* IoT deal with **Onboard** (Dec 2025) and a Cat Remote Fleet Vision deal (2022), and uses ABS Nautical Systems (2019) — so P&O works with multiple vendors; FitVoyages is *one* claim on their homepage. `[VERIFY]` strength of the FitVoyages-P&O relationship.

### 5.2 Product
From fitvoyages.co (Technology + Solutions pages, accessed 30 Aug 2026):
- **Data ingestion:** onboard sensors, automation systems, noon reports.
- **Hardware/sensors offered:** tank gauging (radar, differential pressure, pressure transmitters); fuel flow (Coriolis mass flow, oval gear, ultrasonic — including **clamp-on ultrasonic** for non-invasive installation, per Delstin's posts); temperature; engine parameters.
- **Software platform:** offshore dashboard — real-time monitoring, engine health, fuel usage, CO₂/NOₓ emissions monitoring "for compliance," cargo/freshwater monitoring, crew management (off/on-signing, certification tracking), performance/fuel optimization (mode-wise operations, ROB monitoring, daily consumption trends), analytics/reporting/benchmarking, predictive maintenance, data-quality validation.
- **Integration:** "seamless inbound/outbound integrations to VMS/ERP solutions."
- **Deployment:** "Host all data on YOUR servers" (on-prem/self-hosted) — a notable data-residency/ownership selling point.

### 5.3 Target customers
Offshore support vessels (OSVs), anchor-handling, PSVs, offshore energy fleets. NOT superyachts. `[SOURCE]` site + Delstin posts.

### 5.4 Emissions/TEU-ETS position (critical)
- Marketing claims generic "environmental compliance," "meet IMO standards," "emissions tracking," and Delstin posts heavily about **EU ETS for offshore vessels ≥5000 GT** and fuel/consumption data integrity.
- **No EU ETS, FuelEU, or THETIS-MRV-specific compliance workflow, calculation, or reporting capability is visible anywhere public.** `[SOURCE]` site pages.
- Delstin explicitly frames FitVoyages as producing **"proof of performance" dashboards and reports** for "regulatory auditors or charterers" — i.e., they provide data/evidence, not the regulatory determination. This is exactly the upstream role Poseidon wants. `[SOURCE]` LinkedIn post Jun 22 2026.

### 5.5 API / data exposure (VERIFY-heavy)
- Website claims "seamless inbound/outbound integrations to VMS/ERP" but **no public API documentation, no developer portal, no public schema, no open API endpoints.** `[SOURCE]` site — absence of evidence. `[VERIFY]` — ask directly what an API/data feed looks like today.

### 5.6 Data classification (what they could plausibly expose)
See Section 8. Generally: **likely to have strong fuel-flow (mass flow, density), engine/shaft power, operational mode, tank/ROB, noon-report, and position data**; **probably weaker on** EU-port classification, per-voyage fuel segregation by EU/non-EU leg (they're offshore/DP-heavy, not liner), emissions factors, and compliance-specific fields.

---

## 6. POSEIDON CAPABILITIES

### 6.1 What Poseidon actually is (verified from code)
Full-stack Next.js 14 / TypeScript / Supabase app. Deterministic, unit-tested compliance engines:

| Engine | Module | What it computes (verified in code) |
|---|---|---|
| **EU ETS** | `src/lib/eu-ets/` | GT scope (≥5000 GT), MRV scope (≥400 GT), TtW CO₂ from fuel deliveries, voyage coverage classification (INTRA_EU 100% / EU↔third 50% / non-EU 0%), phase-in rate (40%→70%→100%), EUA obligation, price, estimated cost, deadlines (MRV 31 Mar, surrender 30 Sep) |
| **FuelEU** | `src/lib/fueleu/` | Energy input (MJ via LHV), WtW GHG intensity (gCO₂e/MJ), target intensity (baseline 91.16 × reduction), compliance balance, surplus/deficit, penalty estimate (€2400/tonne VLSFOe), biofuel/ISCC flags, OPS energy, **pooling building block** (`pooling.ts`) |
| **EU MRV / THETIS** | `src/lib/mrv/` | Completeness check, annual report generation, pre-submission checklist, XML/CSV export matching THETIS schema, verifier package builder, content hash |
| **Med SOx ECA** | `src/lib/sox-eca/` | Zone entry/exit events, sulphur content vs limit, watch state, alerts (effective from 1 May 2025) |
| **Certificates** | `src/lib/certificates/` | Certificate registry, status engine, requirements, expiry |

### 6.2 Data layer (verified)
- **Vessels** keyed by 7-digit IMO (unique); `gross_tonnage` column present.
- **Voyages**: port-to-port legs, departure/arrival port + time, distance_nm, provenance (`source_is_mock`).
- **AIS positions**: high-volume time-series (lat/lng, SOG/COG/heading, ts).
- **Fuel deliveries**: BDN-linked, fuel_type (17 fuel types with CO₂/SOx/PM factors), quantity_mt, density, sulphur %, results of OCR extraction; reconciliation log (append-only) linking to voyages.
- **Noon reports**, **port calls**, **zone events**, **vessel tracks**, **review tasks**, **audit log**.
- 50 tables, RLS deny-by-default. Ingest via `src/app/api/` (~109 endpoints) including `vessels/[imo]/voyages`, `vessels/[imo]/eu-ets/[year]`, `vessels/[imo]/fueleu/[year]`, `vessels/[imo]/mrv/[year]`, `vessels/[imo]/noon`, and an email-ingestion webhook (Resend).

### 6.3 Demo experience (verified)
Login: `operator@poseidonledger.com` / `demo1234` (`src/constants/demo.ts`). Default IMO `9074729` (Aurelia). 5 seeded vessels; Greek port **Piraeus** is central in seed data (voyages Piraeus→Valencia, Rotterdam→Piraeus, Piraeus→Marseille; BDN at Piraeus; org is "Poseidon Shipping" with a Piraeus/Athens address). This makes a Greece-anchored demo very natural. `[SOURCE]` demo-seed.ts.

### 6.4 Key limitation relevant to the meeting (from code + audit docs)
- **Voyage-level fuel attribution is simplified**: EU ETS (v1) distributes total CO₂ *equally* across voyages and applies coverage factors — it does **not** yet take per-voyage physical fuel consumption as received from a partner feed. `[SOURCE]` `eu-ets/service.ts:36-45`. Same for MRV (`mrv/service.ts` "Simplified: distribute deliveries across voyages").
- **No outbound HTTP webhook mechanism** exists; notifications are in-app (settings/zone/SOx events). `[SOURCE]` — grep found no webhook. A FitVoyages→Poseidon inbound API feed is conceptually compatible (`ingest/marinetraffic`, `webhooks/email`) but there's no generic partner vendor ingestion endpoint yet — would be net-new. `[INFERENCE]`
- **No literal bank/borrow UI**; FuelEU uses banking + pooling (`pooling.ts`, search-tools line 366). "Borrowing" is not implemented as a distinct nav item.

---

## 7. PRODUCT OVERLAP — ARCHITECTURE MODEL

```
Vessel / onboard systems (flow meters, tank gauges, engine, AIS, noon reports)
        │
        ▼
┌─────────────────────────────┐
│ FITVOYAGES                  │  ← "validated operational data" layer
│ • mass flow (Coriolis/oval/ │     - fuel by type & quantity, engine/shaft
│   ultrasonic/clamp-on)      │       power, operational mode, tank/ROB,
│ • tank gauging, engine,     │       position/noon data
│   mode-wise ops, ROB        │
│ • validation & standardise  │
│ • VMS/ERP integration       │
│ • "proof of performance"    │
└──────────────┬──────────────┘
               │  API / data-feed handoff  ⬅ the open question
               ▼
┌─────────────────────────────┐
│ POSEIDON LEDGER             │  ← compliance intelligence layer
│ • EU ETS                    │     ingest validated fuel/voyage data
│ • FuelEU                    │     verify voyages vs AIS
│ • EU MRV / THETIS           │     compute exposure / balance
│ • Med SOx ECA               │     produce regulator-ready outputs
│ • evidence/provenance,      │     + audit trail, verification
│   certificates              │
└──────────────┬──────────────┘
               ▼
Compliance result → EUA exposure, FuelEU balance, MRV report
               ▼
Evidence / provenance / verifier package → submission
```

**The split:** FitVoyages answers *"what happened on the vessel?"* Poseidon answers *"what is owed, under which regulation, and can it survive an auditor?"* They do not overlap on the one point that matters most for collaboration — FitVoyages has no demonstrated EU ETS/FuelEU calculation workflow, and Poseidon deliberately does not collect vessel telemetry. `[SOURCE]` both products.

**Conceptual framing to use live:** "You're closer to the vessel; we're closer to the regulation."

---

## 8. DATA MAPPING — what Poseidon needs vs what FitVoyages likely has

| Data point | Needed for | FitVoyages availability | Basis |
|---|---|---|---|
| Vessel IMO number | Identity / ET S scope | **Likely available** | Standard vessel identity; they index vessels. `[VERIFY]` |
| Vessel gross tonnage (GT) | ET S/MRV scope (≥5000/400) | **Likely available / unknown** | Owner has it; not in their public feature list. `[VERIFY]` |
| Vessel type / class | Classification | **Available** | OSV/offshore profiles. `[SOURCE]` |
| Voyage ID | ETS/MRV reconciliation | **Unknown** | They track legs but unclear if stable voyage IDs exposed. `[VERIFY]` |
| Departure / arrival port | ETS coverage classification | **Likely available** | Position/AIS + port calls implied. `[VERIFY]` |
| Departure / arrival timestamps | Leg boundaries, MRV | **Likely available** | Voyage/port-call tracking. `[VERIFY]` |
| AIS position | Independent verification | **Likely available** (or obtainable) | AIS is common; not clearly their product. `[VERIFY]` |
| Distance (nm) | ETS/MRV | **Likely available** | From AIS/positions. `[VERIFY]` |
| Port calls | Port-call/zone events | **Likely available** | Implied by ops. `[VERIFY]` |
| Fuel consumption (quantity) | ETS + FuelEU (energy) | **Definitely available** | Core product: real-time mass flow. `[SOURCE]` |
| Fuel type (MGO/HFO/VLSFO/LSMGO etc.) | Emission factors, LHV | **Likely available** | They monitor fuel; fuel type in tank/BDN data. `[VERIFY]` |
| LNG / biofuels / methanol | FuelEU intensity, ISCC | **Probably unavailable** | Offshore diesel-electric/DP focus; unlikely alternative fuels. `[INFERENCE]` |
| Fuel density / properties | Accurate mass/energy | **Likely available** (mass flow → density) | Coriolis measures density. `[SOURCE]` (Coriolis) |
| Bunker / BDN events | Evidence, reconciliation | **Probably unavailable** | BDN portside docs, not onboard sensors. `[VERIFY]`; Poseidon has its own BDN/OCR path |
| Quantities delivered | Reconciling consumption | **Probably unavailable** (they measure burn, not bunkering) | `[INFERENCE]` |
| Emissions factors | ETS/FuelEU calc | **Probably unavailable** | That's Poseidon's domain. `[SOURCE]` (product gap) |
| Engine data / shaft power / RPM | Ops context, FuelEU nuance | **Definitely available** | Core product (shaft power). `[SOURCE]` |
| Operational mode (DP/transit/standby) | Ops/context visualisations | **Definitely available** | Core selling point. `[SOURCE]` |
| Cargo / passenger data | Transport work (MRV optional) | **Limited / offshore-specific** | OSVs carry deck cargo, not passengers. `[INFERENCE]` |
| EU/EEA port classification | ETS coverage | **Probably unavailable** | That's compliance logic; Poseidon's `port-classifier.ts` does it. `[SOURCE]` |
| Historical data depth | Annual reporting | **Unknown** — likely limited (young company, founded 2024) | `[INFERENCE]` — Ask how far back |
| Real-time data | Continuous monitoring | **Definitely available** | Core product. `[SOURCE]` |
| Voyage segmentation EU/non-EU | ETS | **Probably unavailable** — they don't do EU-leg compliance | `[INFERENCE]` |
| Evidence attached to events | Audit trail | **Partially — "proof of performance" reports** | `[SOURCE]` Delstin post; extent unknown `[VERIFY]` |

**Key takeaway:** FitVoyages is strong on the *physical measurement* (fuel flow, mass flow, shaft power, mode, ROB, position). Poseidon is strong on the *regulatory interpretation* (EU ports, coverage factors, emission factors, intensity, allowances, deadlines, evidence). The highest-value, most-tractable handoff is: **vessel identity + voyages (ports/times/distance) + fuel consumed by type and quantity.** Poseidon already has machinery to hold and compute all of these.

---

## 9. EU ETS ANALYSIS

### 9.1 How FitVoyages data could feed Poseidon's EU ETS workflow
Poseidon's EU ETS engine (`eu-ets/service.ts`) currently takes:
- `deliveries[]`: id, fuel_type, quantity_mt, delivery_date → used for TtW CO₂.
- `voyages[]`: id, departure_port, arrival_port → used for **coverage classification** (intra-EU / EU↔third / non-EU).
- `gt` → scope (≥5000 GT).

**Where FitVoyages data eliminates manual entry:**
- **Voyage list with departure/arrival ports** (from their voyage/position tracking) → feeds `classifyVoyageCoverage` automatically. This is the biggest manual-data win: it removes the need to type port pairs.
- **Fuel consumed by type and quantity** (from their flow meters) → could populate deliveries/consumption instead of relying on BDN+OCR or manual noon data. Note: consumption ≠ delivered; Poseidon uses `quantity_mt` as the emissions basis, so a flow-meter consumption feed is technically the more accurate basis `[INFERENCE]` but currently the engine keys on deliveries `[SOURCE]`.
- **Singapore/Fujairah vs EU ports** already in seed — non-EU voyages auto-classified at 0%.
- **Distance and timestamps** from position data → voyage legs, MRV distance.

### 9.2 Where Poseidon still requires human confirmation / documentary evidence
- **Responsible entity / allowance debt attribution:** who (owner, ISM company, charterer) is the responsible entity for surrendering EUAs. Poseidon has org structures but commercial EUA settlement between charterer/owner is a *separate* documented determination (see Lloyd's Register VERS framing — EUA/charter-party settlement is its own workflow). `[VERIFY]` — Poseidon doesn't yet model charter-party EUA cost allocation.
- **MGO/distillate vs residual confirmation:** flow meters give quantity, but the *emissions factor* depends on the correct fuel-type mapping; density/sulphur from the BDN/ISO cert may still need documentary confirmation where flow data alone is ambiguous. `[INFERENCE]`
- **Vessel GT** must be confirmed (certificate/class), not assumed from data provider.
- **EU-port classification edge cases** (e.g., UK post-Brexit, EEA non-EU ports) — Poseidon's classifier is deterministic/heuristic, not a legal determination; a human confirms contested cases. `[SOURCE]` port-classifier.ts comment.

### 9.3 Numeric anchor (verified from parameters.ts)
- Phase-in: **2024=40%, 2025=70%, 2026+=100%**.
- Voyage coverage: intra-EU 100%, EU↔third 50% each way, non-EU 0%.
- EUA surrender deadline: **30 September** each year; MRV report: **31 March**.
- Seed EUA price €78.5 (`demo-seed.ts`), with a `eua-price/provider` abstraction.

---

## 10. FUELEU MARITIME ANALYSIS

### 10.1 What FitVoyages data could contribute
Poseidon's FuelEU engine (`fueleu/service.ts`) takes `deliveries[]` (fuel_type, quantity_mt) → energy (MJ via LHV) → WtW GHG intensity → compliance balance vs target → penalty.

**FitVoyages upstream contribution:**
- **Fuel consumed by type and quantity** → the dominant input for energy + WtW intensity. This is the highest-value data handoff for FuelEU.
- **Operational-mode data (DP/transit/standby)** → contextual; useful for explaining energy patterns and possibly for voyage/port segmentation. FuelEU is largely a per-annual-energy + per-voyage-to-EU analysis; FitVoyages' mode data adds explanatory power but is not strictly required for the calculation.
- **OPS / shore power** — Poseidon models `ops_energy_mj` and `ops_data_available`. FitVoyages may or may not capture shore-power consumption; `[VERIFY]`. Shore power is a FuelEU compliance lever (credit), so if FitVoyages can expose it, that's genuinely valuable.
- **Biofuel blending** — Poseidon flags ISCC certification gaps (`iscc_missing_flag`, `iscc_missing_details`). FitVoyages could report blended biofuel (e.g., B30) proportions, but **ISCC certification documentation** still requires documentary evidence Poseidon's certificate/OCR engine can handle. `[SOURCE]` seeds show B30 with ISCC-missing flags.

### 10.2 Where FitVoyages could be the upstream provider and Poseidon the intelligence layer
- FitVoyages = validated fuel flow by type/voyage + position/port info (the "what").
- Poseidon = LHV/WtW factors (versioned `parameters.ts`), energy weighting, intensity vs target curve, compliance balance, **banking/pooling** (`pooling.ts`), penalty exposure, ISCC evidence, and annual FuelEU reporting/verifier output (the "owed / balance / evidence").
- This satisfies the "operational-data → compliance" thesis most cleanly, because FitVoyages clearly lacks FuelEU-specific mechanics and Poseidon has them built and tested. `[SOURCE]` both.

### 10.3 Numeric anchor (verified)
- Baseline GHG intensity **91.16 gCO₂e/MJ**; reduction targets 2% (2025-29), 6% (2030-34), 15% (2035-39), 31%, 62%, 80%.
- Penalty estimate €2400 / tonne VLSFOe (`penalty_formula 2025.1`).
- LHV registry + WtW registry per fuel (fossil HFO 87.5, MGO 85.7, LNG 76.0, bio-HFO 20.5, bio-MGO 19.8, ammonia 82.0, H2 85.0, methanol 81.0 gCO₂e/MJ).

---

## 11. EU MRV / THETIS-MRV

### 11.1 What can be automated
- **Voyage entries** (ports, dates, distance): if FitVoyages exposes clean voyage/leg data → directly populates MRV voyage entries, eliminating manual entry.
- **Fuel consumption** (per voyage): if FitVoyages can attribute fuel flow to legs → replaces the current *equal-distribution* simplification (`mrv/service.ts` "distribute deliveries across voyages"). This is a **big accuracy improvement** and a compelling integration selling point `[INFERENCE]`.
- **Completeness checks & checklist**: automated by `mrv/completeness.ts` and `mrv/checklist.ts`.

### 11.2 What must be validated / documented
- **Annual fuel totals** must reconcile with bunker delivery notes (BDN) and the statutory logbook — a verifier requires documentary trail, not just flow-meter totals. Poseidon's fuel-delivery/BDN + OCR path covers this; FitVoyages flow meters alone are insufficient as the *sole* MRV fuel source `[INFERENCE]`. Flow vs delivered (ROB reconciliation) discrepancies are already the industry pain point Delstin posts about `[SOURCE]`.
- **Vessel identity + IMO + GT** must match the MRV Monitoring Plan. Poseidon's scope check uses GT `[SOURCE]`.
- **Monitoring Plan** version tracking — Poseidon has a `monitoring_plan_version` field but the docs `[VERIFY]` whether a full monitoring-plan authoring workflow exists.

### 11.3 Where human review / discrepancies occur
- **Completeness BLOCKED** states (like the seeded Neptune MRV report: DRAFT/FAILED, missing 6 voyages) drive a human review queue (`review-tasks`, `review/[id]`, `ocr-quality`). This review layer is a strength to show — it demonstrates that Poseidon doesn't silently estimate.
- **ROB / noon vs flow-meter discrepancies**: exactly the "which do you trust?" problem Delstin raises. Poseidon's reconciliation_log + review tasks are the place that gets resolved — an integration pitch aligned with their own pain point. `[SOURCE]` Delstin post + Poseidon schema.

---

## 12. API INTEGRATION CONCEPT — the big technical question

### 12.1 Minimum viable dataset for ONE real compliance workflow to work
> If FitVoyages gave Poseidon an API, the minimum viable dataset is:

**Vessel dimension (once per vessel):**
- IMO number (mandatory — identity + scope)
- Gross tonnage (GT) — for ET S/MRV scope

**Per voyage/leg:**
- Voyage ID (stable)
- Departure port + timestamp
- Arrival port + timestamp
- Distance (nm) — optional but useful

**Per consumption event (ideally per voyage, or per day + voyage mapping):**
- Fuel type (MGO / VLSFO / HFO / LSMGO, etc.)
- Quantity consumed (mass flow integrated, in tonnes)

That is enough for the EU ETS workflow: voyages classify coverage, fuel → TtW CO₂, GT → scope, coverage factors + phase-in → EUA obligation → cost. **One vessel + one customer + one workflow is technically plausible against the real Poseidon implementation.** `[SOURCE]` `eu-ets/service.ts` inputs.

### 12.2 FuelEU additionally wants
- Same fuel-by-type + quantity (energy), plus optional OPS/shore-power energy and biofuel (blend % + ISCC) info. Feasible with the same feed + a couple extra fields.

### 12.3 What's realistic as a first integration (MVP)
- **Direction:** FitVoyages → Poseidon (operational data in), Poseidon → compliance result (out to user / report). One-way inbound feed is the right first shape `[INFERENCE]`.
- **Transport:** scheduled batch or per-voyage post (compares to existing `ingest/marinetraffic` pattern of polling + mock flag). No real **outbound webhook** exists in Poseidon (`[SOURCE]`), so prefer Poseidon *pulling* a FitVoyages export, or FitVoyages *pushing* to Poseidon's API.
- **Identity resolution:** match on IMO. Poseidon already keys vessels by IMO `[SOURCE]`.
- **Poseidon adaptation needed `[INFERENCE]`:** a partner-vendor ingestion endpoint (currently only MarineTraffic + email webhook exist), and the EU ETS engine's per-voyage fuel attribution (currently equal-distribution). Net-new but modest.

### 12.4 What should NOT be in the first integration
- Two-way live sync, raw AIS from FitVoyages, white-label module, multi-fleet rollout, alternative-fuel/LNG accounting (until data exists). Defer these; don't propose them as milestone 1.

---

## 13. GREECE / CUSTOMER OPPORTUNITY

### 13.1 What "Greece" appears to refer to `[INFERENCE]`
The playbooks repeatedly reference Mediterranean superyachts and yacht-management companies as Poseidon's target segment, and the seed data is Greek-anchored (Poseidon Shipping, Piraeus base, Piraeus voyages/BDN). There is **no documented external Greek customer** in the files — it is Poseidon's *positioned* home segment rather than a confirmed named buyer. `[VERIFY]` — whether you actually have a Greek prospect in mind.

### 13.2 FitVoyages' Greece relevance
- FitVoyages is Dubai/India-based, target = offshore energy / OSV, **not** yachts. There is **no evidence of a Greek presence or Greek superyacht focus** in their public material. `[SOURCE]` absence.
- Greece is the world's largest shipping nation by tonnage, and Greek owners face the same EU ETS (2024+) / FuelEU (2025+) obligations. If either company has a Greek connection, it's an *opportunity*, not a current FitVoyages strength. `[INFERENCE]`

### 13.3 Realistic Greece framing for the meeting
- Do NOT assume FitVoyages has Greek customers. Ask directly (Section 16) whether they have any Mediterranean / Greek fleet interest.
- Anchor the *value* in EU ETS 2027 for offshore vessels and FuelEU 2025 — these are **hard deadlines now hitting OSVs**, and Delstin is already marketing to that (`[SOURCE]` his June EU ETS post). Greece is a natural place their OSV clients trade.
- The smallest pilot: one FitVoyages-connected OSV ≥5000 GT making EU calls → map its fuel/voyage data → Poseidon ETS + FuelEU position. Realistic only if such a vessel/customer exists `[VERIFY]`.

---

## 14. PILOT PROPOSAL

### 14.1 Is the ideal outcome realistic?
**Yes, technically.** Poseidon's engines accept exactly the inputs FitVoyages produces. `[SOURCE]` engine input types.
**Commercially, it depends on one unresolved fact:** whether FitVoyages has a real client + vessel + EU call pattern to anchor it. `[VERIFY]` — ask directly.

### 14.2 The smallest possible pilot — "one vessel"
```
FitVoyages vessel (OSV ≥5000 GT, EU/EEA calls)
  → export per-voyage: IMO, GT, ports, times, distance, fuel type+qty
  → Poseidon ingest (new partner endpoint)
  → EU ETS calculation → EUA exposure + cost estimate
  → evidence trail + first compliance view
```
Success criteria: one vessel's data flows end-to-end, one EU ETS number produced with a traceable audit path, both teams agree on the mapping.

### 14.3 Framing that isn't desperate
- Present it as a *data/API mapping exercise first* (option B) that can *become* a pilot (option A) if a real vessel exists. Don't ask for a signature.
- Ask: "If we took one vessel you already have instrumented, and mapped its fuel and voyage data into a single EU ETS position, would that be a useful thing to wire end-to-end?"

---

## 15. DEMO WALKTHROUGH (10–15 min, Poseidon)

> Basis: verified code paths + seed data. **Do not demo features that don't exist.** Login `operator@poseidonledger.com` / `demo1234`. Default IMO `9074729` (Aurelia). Priority order: operational data→compliance, EU ETS, FuelEU, evidence, reporting/auditability.

### Screen 1 — Dashboard (30–60s)
- **Click:** sign in → land on dashboard (`/`).
- **Show:** vessel count, active voyages, compliance alerts, review queue.
- **Say:** "This is the compliance window on a fleet. The piece most relevant to you is the pipeline from vessel data to the numbers here — every number traces back to source data."
- **Why it matters to FitVoyages:** establishes Poseidon is a real, working system, not a deck.
- **Ask:** "Do you show a similar fleet-level view from the operational side?"

### Screen 2 — Fleet / vessel (2 min)
- **Click:** Fleet → pick a vessel (Aurelia, IMO 9074729).
- **Show:** vessel identity (IMO, GT), the structured vessel record.
- **Say:** "Vessels are keyed by IMO. For compliance we need GT and identity — the rest of what we consume is voyage and fuel data."
- **Why it matters:** surfaces the exact identity fields an integration must carry (IMO, GT).
- **Ask:** "In your platform, is a vessel tied to a stable IMO you can expose through an API?"

### Screen 3 — Voyage view (2 min)
- **Click:** Voyages → a voyage (e.g., Aurelia Piraeus→Valencia).
- **Show:** departure/arrival port + time, distance, coverage classification, ETS coverage rate.
- **Say:** "Every voyage is classified for ETS coverage — intra-EU at 100%, EU to third country at 50%, non-EU at zero. That classification is exactly the kind of thing that can come straight from your voyage data instead of being typed in."
- **Why it matters:** the operational-data→compliance handoff lives here.
- **Ask:** "Do you segment voyages EU/non-EU today, or is that something we'd classify together?"

### Screen 4 — EU ETS (2 min)
- **Click:** vessel → EU ETS tab/record for year (2025).
- **Show:** GT scope, total TtW CO₂, covered CO₂, EUA obligation, EUA price (€78.5 seed), estimated cost, surrender deadline (30 Sep), MRV deadline (31 Mar).
- **Say:** "This is the allowance position: fuel consumed, weighted by voyage coverage and the phase-in rate — 70% in 2025, 100% from 2026 — against the surrender deadline. Feed us fuel by type and per-voyage, and this computes itself."
- **Why it matters:** concrete, penalty-bearing compliance output.
- **Ask:** "Is per-voyage fuel consumption the natural unit you can expose?"

### Screen 5 — FuelEU (2 min)
- **Click:** vessel → FuelEU record (2025 FINAL / 2026 PROVISIONAL).
- **Show:** energy input (MJ), WtW GHG intensity (gCO₂e/MJ), target intensity, compliance balance (surplus/deficit), penalty exposure estimate, biofuel/ISCC flags.
- **Say:** "FuelEU is the hotter problem — well-to-wake intensity against a target that drops every period, a compliance balance, and a penalty exposure. The fuel type and quantity are exactly your data; the intensity, target, and balance are ours."
- **Why it matters:** FuelEU is the area FitVoyages least covers and hardest to build.
- **Ask:** "Do any of your clients track their FuelEU intensity or balance today? If not, that's the gap we'd fill."

### Screen 6 — Evidence / OCR / review (2–3 min)
- **Click:** Documents → a BDN/noon document; show OCR extraction + data quality/review queue (`/review`, `/ocr`).
- **Show:** a document → extracted fields → reconciliation; the review-tasks queue; how a gap is *flagged*, not silently estimated.
- **Say:** "This is the evidence layer. A BDN or noon report becomes structured fuel data with an audit trail, and if there's a gap or a quality question it goes to a review queue rather than being guessed. That's the difference between a number and a defensible number."
- **Why it matters:** the audit-defensibility differentiator; also mirrors FitVoyages' own "which number do you trust?" pain point.
- **Ask:** "How do you currently handle the gap between what a sensor reports and what the noon report or bunkering says?"

### Screen 7 — Compliance reports / verifier (2 min)
- **Click:** Compliance workspace → reports (THETIS-MRV, FuelEU, fleet summary), verifier packages, SOx watch.
- **Show:** a generated report, the verifier-package builder, MRV XML/CSV export with content hash.
- **Say:** "This is the regulatory output — THETIS-MRV reports, FuelEU position, verifier packages with a content hash so a report can't be altered silently. For an OSV now facing the 2027 ETS deadline, this is what a client would actually need to submit."
- **Why it matters:** close the loop from operational data → submitted compliance output.
- **Ask:** "When a client asks you for 'proof of performance' for an auditor, what does that handoff look like today? That's the moment we could plug in."

### Screen 8 — Close the demo (1 min)
- **Say:** "That's the compliance layer. It's deliberately built on exactly the kind of validated operational data you produce — I'd like to understand how we could wire a feed between the two."
- **Transition:** "Before we go further — can you show me how the platform presents fuel and performance data on your side?" (Moves to their demo.)

---

## 16. QUESTIONS TO ASK THEM

### 16.1 Ten essential questions (in priority order)
1. **"Have any of your current clients asked you directly about EU ETS or FuelEU?"** — the single highest-value question; reveals whether this is customer-pulled.
2. **"What data does your validated layer actually expose today, and in what format?"** — scopes the API reality.
3. **"Do you have an API or a data feed a third party could consume today, or would that be custom work?"** — probes real engineering maturity vs brochure.
4. **"Where does your validated data stop and a client's own reporting begin today?"** — exposes the gap (compliance) they may not have named.
5. **"How do you handle the gap between what a flow meter reports and what the noon report / bunkering says?"** — ties directly to their own pain point and to Poseidon's evidence/reconciliation layer.
6. **"Can you attribute fuel consumption to a specific voyage (EU leg vs non-EU leg), and how far back does historical data go?"** — the crux of ETS/MRV feasibility + data depth.
7. **"Do you capture shore-power (OPS) consumption, and do any clients blend or use biofuels?"** — FuelEU-specific levers.
8. **"Who owns the client data relationship if a fleet works with both of us — and what are your controller/processor roles under GDPR?"** — governance; also surfaces hierarchy assumptions.
9. **"How do you decide what to build in-house versus bring in through a partner?"** — surfaces build-vs-buy posture.
10. **"What's driving the timing of this conversation now?"** — reveals whether it's customer-pulled, investment-adjacent, or exploratory.

### 16.2 Twenty optional technical questions
1. What's your current data schema for fuel and voyage data?
2. What's your API authentication and rate-limiting model, if one exists?
3. How do you version your own data model when it changes?
4. What's your error-handling approach when upstream sensor data is inconsistent?
5. Do you support event-based updates or webhooks, or is it pull/batch?
6. What frequency do you emit data at (real-time, daily, per-voyage)?
7. What granularity is your fuel data — per-engine, per-mode, per-leg, per-day?
8. Do you provide fuel density and sulphur content alongside mass flow?
9. How do you reconcile fuel *consumed* versus fuel *delivered* (ROB discrepancies)?
10. Do you expose engine/shaft-power and operational-mode (DP/transit/standby) data with timestamps?
11. How is a "voyage" or "leg" defined in your system — who or what triggers the boundary?
12. Can you provide IMO + GT per vessel in an exported record?
13. What does a typical client onboarding and integration actually take (timeline/lift)?
14. What's the longest integration you've done, and why?
15. How do your white-label deployments handle brand vs vendor (who supports the client)?
16. Do you host fully on client servers, and how does that affect third-party data exchange?
17. What compliance/emission standards do you currently report against (if any actual ones)?
18. Does your platform differentiate EU/EEA ports today?
19. How do you normally expose data to third parties — files, API, data warehouse, SFTP?
20. What's your data retention / deletion policy, and who controls it under your "your servers" model?

---

## 17. QUESTIONS THEY MAY ASK ME (with intent + answers)

20 predicted questions, ranked by likelihood given the room.

| # | Question | What they're really determining | Strong answer | Honest answer if we don't know | What NOT to say |
|---|---|---|---|---|---|
| 1 | How do you get your data? | Is Poseidon real / dependent? | "We don't collect telemetry; we consume structured operational data from partners and verify voyages against AIS." | — | Implying we have our own sensor pipeline |
| 2 | Do you have an API today? | Is it built? | "Yes — a working ingestion API for structured operational data; the existing endpoints take vessels, voyages, fuel." | "A first partner-vendor mapping is data-format scoping, not from scratch." | "Yes" then being unable to show it |
| 3 | How do you calculate ETS exposure? | Domain competence test (Theo) | "Fuel × emission factor per voyage, weighted by coverage (intra-EU/EU↔third/non-EU) and phase-in (70% 2025, 100% 2026), reconciled to the surrender deadline." | "Happy to walk the full parameter table." | Reciting every regulation line |
| 4 | How does FuelEU work in your system? | Depth beyond ETS | "Energy (LHV) → well-to-wake intensity vs target → compliance balance; pooling/banking as ledger ops; penalty estimate." | — | Conflating FuelEU with ETS |
| 5 | Why wouldn't we just build this? | Build-vs-buy (Theo) | "You could — it's public logic. The cost is maintaining an audited, versioned compliance system as the regulations move, beside your core product." | "It took us [honest time] to get it solid and versioned." | Claiming a secret technical moat |
| 6 | Will you go direct to our customers? | Trust/competition | "No — different buyer (Mediterranean yachts vs OSV); any move into your segment would be through partnership." | — | "Never say never" hedging |
| 7 | How are you different from emissions tracking? | Protecting their positioning | "Tracking tells you what happened; compliance tells you what you owe and whether the record survives an auditor." | — | Dismissing their product |
| 8 | Are you competing with us? | Threat | "No — we don't touch sensors/hardware/monitoring; we're a downstream consumer of validated data." | — | Vague positioning |
| 9 | Where is data hosted, who owns it? | Governance | "Client owns operational data; Poseidon's output is a derived compliance record. Hosting/DPA is a proper next-step conversation." | Flag DPA as a defined follow-up | Improvising GDPR roles |
| 10 | What's your pricing/commercial model? | Is traction real? | "Subscription tied to fleet size, sold to yacht managers. Too early for bundled numbers until an integration is scoped." | — | Deflecting entirely or quoting bundles |
| 11 | How many customers do you have? | Traction | State honestly + "we prioritised getting the regulatory mechanics correct before scaling — it's a penalty-bearing product." | Give real number | Inflating |
| 12 | What happens when regulation changes? | Durability | "Parameters are versioned, not hardcoded — historical records stay pinned to the rules that applied." | — | "We'd ship a code fix" |
| 13 | What raw vs validated data do you need? | Scoping | "Your validated output, ideally — one source of truth, less duplicated validation." | — | Asking for raw feeds "just in case" |
| 14 | What if your number and ours disagree? | Traceability | "A data question, not compliance — trace both through the audit trail to where they diverge; validated feed is the reference unless overridden." | — | "Ours is right" |
| 15 | How do you produce THETIS-MRV output? | Real workflow vs report gen | "Same audited calculation populates the MRV template directly; XML/CSV export with content hash; verifier package." | — | "It's just an export" |
| 16 | Are you funded / raising? | Ambiguity | State plainly, redirect to partnership scope. | — | Turning it into a pitch |
| 17 | How do you handle noon-report-only vessels? | Data-quality honesty | "Calculations run on noon-derived data with lower confidence, clearly flagged — we degrade gracefully and transparently." | — | Claiming same accuracy as sensors |
| 18 | Do you support multi-flag/multi-fleet? | Scope honesty | "Current scope is EU ETS/FuelEU/THETIS-MRV; flag-state nuance is versioned but `[VERIFY]` exact coverage." | Say if untested | Overclaiming |
| 19 | What's the biggest risk to your business? | Candour | Honest, specific answer (e.g., narrow segment/traction). | — | "We're confident" deflection |
| 20 | What do you need from us to move forward? | Readiness | "A scoping call between our engineers and yours on data format, and clarity on whether a real client use case exists to anchor it." | — | Asking for something binding |

---

## 18. EXACT PHRASES TO SAY

### Opening
"Good to meet you all — thanks for pulling this together. I'm Gabriel, I run Poseidon Ledger; we handle EU ETS, FuelEU, and THETIS-MRV compliance for Mediterranean yacht fleets. I'd like to give you the shape of what we do, then really hear how you think the two connect."

### Transition into FitVoyages demo
"That's the compliance layer, and it's deliberately built on exactly the kind of validated operational data you produce. I'd genuinely like to see how you present fuel and performance data on your side before we talk about the handoff."

### Asking technical questions
"Can you attribute fuel consumption to a specific voyage — and how far back does the historical data go?" / "Is this coming directly from the vessel flow meters, or is any of it manually entered or estimated?"

### Transition FitVoyages → Poseidon
"What you're solving is the question of what happened on the vessel. What we solve is what's owed, under which regulation, and whether that answer survives an auditor. Let me show you that second half."

### Starting Poseidon demo
"Let me walk you through the compliance layer. I'll start from the fleet level and go into a vessel, a voyage, and then the EU ETS and FuelEU position — and where your data would slot in, I'll say so."

### Explaining EU ETS
"EU ETS is an allowance obligation: fuel burned per voyage, weighted by whether the voyage is intra-EU, EU-to-third-country, or at berth, multiplied by the phase-in rate — 70% this year, 100% from 2026 — against a surrender deadline at the end of September."

### Explaining FuelEU
"FuelEU is different from ETS: it's not a payment for emissions, it's a limit on the *intensity* of the energy you use, measured well-to-wake, with a compliance balance against a target that tightens every period. Feed us fuel by type and quantity, and we compute the energy, the intensity, the balance, and the penalty exposure."

### Explaining the evidence layer
"Every number in the system traces back to its inputs and method. If there's a gap or a data-quality question, it goes to a review queue rather than being guessed — that's the difference between a number and a defensible number."

### Discussing API integration
"Your validated fuel and voyage data is exactly the single source of truth we'd want to consume rather than rebuild. A first integration is a data-format scoping conversation between our engineering and yours — not a rebuild."

### Discussing Greece
"We're anchored in the Mediterranean — that's our segment. If your OSV clients are trading into EU ports, the same deadlines apply to them; the 2027 ETS threshold for offshore vessels is exactly the kind of thing that's starting to bite."

### Discussing a pilot
"The cleanest way to test this isn't a platform-level integration — it's one vessel and one workflow. If you have a client with a vessel making EU calls, we map its fuel and voyage data into a single EU ETS position and see if the numbers hold up end-to-end."

### Discussing commercial collaboration
"Realistically the first shape is a data-feed handoff plus a referral relationship — low-commitment, proves the mechanics. Anything deeper like an embedded module comes after there's a real integration to point to."

### Handling uncertainty
"That's a fair question and I don't want to guess at it — I'd rather check the parameter and follow up than give you a confident-sounding answer that's wrong."

### Handling a difficult technical question
"Possible — walk me through how you're reading it, I'd rather get this right than defend a position. If that changes the number, I'll verify it properly after the call and come back to you."

### Closing the meeting
"The clearest next step is a short technical scoping call between our engineering and yours on data format — and separately, flagging the data-governance conversation for once there's a real integration to scope. I'll send a short note with a proposed scope by Friday. Appreciate the time."

---

## 19. RISKS / WEAKNESSES

### 19.1 What could make FitVoyages lose confidence in Poseidon
1. **Overselling the API**: playbooks imply "a working ingestion API"; the API exists, but a *generic partner-vendor ingestion endpoint* does not — only MarineTraffic + email webhook + vessel-scoped ops endpoints. If Theo asks "is there an endpoint I can push a feed to?" be precise. `[VERIFY]` exactly what the API surface is before the call.
2. **Being exposed on the "equal-distribution" simplification**: EU ETS and MRV currently distribute total CO₂/fuel *equally* across voyages rather than using per-voyage physical consumption. If a technical person asks "does your calc use per-voyage fuel from us?" the honest answer is: not yet in v1; it's the integration target. Don't claim fine-grained per-voyage allocation that the code doesn't do. `[SOURCE]` service code.
3. **Claiming FuelEU pooling/banking/borrowing is a complete engine**: `pooling.ts` exists as a building block + search-tools references banking and pooling, but there's **no visible borrowing** and pooling is a foundation, not necessarily a shipped UI. Be accurate about maturity. `[SOURCE]`
4. **Traction inflation**: don't round up customer/revenue numbers — a technical room will probe.
5. **Blurring the compliance/monitoring line**: any hint Poseidon wants to build monitoring features, or AIS products, reads as competing with FitVoyages.
6. **GDPR/hosting improvisation**: don't guess controller/processor roles; flag DPA as a next step.
7. **"AI" overclaiming**: their brand is AI-heavy; matching it dilutes your audit-defensibility story and reads as marketing.

### 19.2 Claims to avoid
- "We automate everything." 
- "We replace spreadsheets" (trivialises a regulatory discipline).
- "Our AI does the heavy lifting."
- "We're disrupting the compliance space."
- Any hint of interest in their existing customer base.

### 19.3 Demo parts that could expose weaknesses
- The **voyage detail** AIS-gap visualisation (`voyage/page.tsx`) shows `MANUAL_REQUIRED`/`CRITICAL_ESCALATION` tiers — impressive honesty, but make sure the demo data isn't in a bad state that confuses the narrative. `[VERIFY]` demo state pre-call.
- The **equal-distribution** in ETS/MRV is visible if someone inspects voyage contributions (`perVoyageCo2`). Prepare the "that's exactly what per-voyage fuel data fixes" line.
- **Neptune MRV = DRAFT/FAILED** (missing 6 voyages) is a *feature* (showcases review/BLOCKED), not a bug — but explain it deliberately so it reads as design, not incompleteness.

### 19.4 Questions that could embarrass if unprepared
- "What does your partner-vendor ingestion endpoint look like today?" (doesn't exist generically)
- "Does your ETS calc use per-voyage fuel or total fuel split evenly?" (equal-distribution)
- "Show me the pooling engine." (barely shipped)
- "What share of a voyage do you count?" (know the 100/50/0 coverage + phase-in flawlessly)
- "How old is the longest continuous dataset you've processed?" (seed data is synthetic `source_is_mock`)

### 19.5 Verify before the meeting
- Exact API/auth surface (`[VERIFY]`).
- Whether a generic partner ingestion endpoint exists or needs build (`[VERIFY]`).
- Names/roles of actual attendees (Mira/Theo real?) and Delstin's actual role (`[VERIFY]`).
- Demo data state (which vessel shows cleanly, AIS coverage, MRV status) (`[VERIFY]`).
- Your honest traction/funding/customer answers (`[VERIFY]`).
- Whether you truly have a Greek prospect (`[VERIFY]`).

---

## 20. FITVOYAGES' WEAKNESSES (what Poseidon could provide)

> Distinguish evidence from inference.

- **No demonstrated EU ETS / FuelEU / THETIS-MRV compliance workflow** — public site claims only generic "environmental compliance / meet IMO standards / emissions tracking." `[SOURCE]` (absence). This is the cleanest gap Poseidon fills.
- **Regulatory interpretation is not their lane** — their value is "proof of performance" dashboards (`[SOURCE]` Delstin post), explicitly about data/evidence, not the regulatory determination.
- **Fuel flow ≠ delivered fuel / ROB reconciliation** — Delstin himself posts that noon reports, tank soundings, and fuel reconciliation "tell different stories" (`[SOURCE]`). That reconciliation/discrepancy layer is exactly Poseidon's `reconciliation_log` + review queue.
- **Very early / thin** — ~3 staff, founded 2024, founder is an IT-services person (not marine engineer), build possibly via Qubicle. `[SOURCE]` LinkedIn. Means limited domain depth in EU regulation. `[INFERENCE]`
- **White-label may mean no direct compliance-brand credibility** — marrying a known compliance record layer could make their platform more defensible. `[INFERENCE]`
- **No public API** for third-party compliance consumption. `[SOURCE]` (absence) — a partner like Poseidon could define the integration shape.

---

## 21. COMMERCIAL MODELS

| Model | Advantages | Disadvantages | Technical complexity | Commercial potential | What should happen FIRST |
|---|---|---|---|---|---|
| **Referral** | Zero build, builds trust, mutual | Low revenue per event | None | Modest but genuine | First — easiest trust step |
| **API / data-feed integration** | Real product synergy, repeatable | Needs scoping + build on both sides | Medium | High — opens pipeline | FIRST technical step; anchor on a real vessel |
| **Integrated solution** | Stronger value prop | More coordination, risk of scope creep | High | High | Only after a working feed |
| **Embedded compliance module (in FV dashboard)** | Seamless client UX | Requires real integration to point to; borderline into joint product | High | High | Later, after proof |
| **White-label (Poseidon under FV brand)** | Fits FV's model | Premature, governance/complex, could blur responsibility for compliance | Highest | High but risky | NOT now — defer |
| **Joint customer pilot** | Direct proof, revenue | Needs a real customer | Medium | High | The recommended target |

**Guidance:** Do NOT push white-label or a full joint product in a first meeting. Lead with **referral + API-feed scoping**, and steer toward a **joint pilot on one vessel** if a real customer exists.

---

## 22. MEETING AGENDA (~60 min)

| Time | Phase | Who drives | Objective |
|---|---|---|---|
| 0–5 | Reconnect / objectives | Delstin + Gabriel | Confirm why we're here; who's who (verify roles) |
| 5–25 | FitVoyages platform / data | FitVoyages | Their product, data, API reality, customers, pain points; Poseidon mostly listens |
| 25–40 | Poseidon demo | Gabriel | Operational-data→compliance screen flow (Section 15) |
| 40–50 | Map the two systems | Both | Data handoff, where compliance gap sits, MVP data set |
| 50–57 | Customer / Greece / pilot | Gabriel | Anchor on one real vessel/customer if it exists |
| 57–60 | Next steps | Both | Name one concrete, owned step + follow-up timing |

*Adjust the split if FitVoyages' demo runs long; do NOT shorten your demo below 10 min if the compliance story is central.*

---

## 23. DESIRED NEXT STEPS

Any one of (in order of preference):
- **A.** Technical scoping call between both engineering teams on data format + a real client/vessel use case. (Best — achieves option B + seeds A.)
- **B.** A joint write-up mapping where operational data meets compliance (low-lift if room is exploratory).
- **C.** Posidion sends a short scoping note by a named day defining the MVP data set + integration shape.

**Owner + by-when:** You send a one-page scoping note within 48h; propose the joint technical call date. Follow-up email within 24h using the internal template in the existing playbook.

---

## 24. SOURCES

### Project (Poseidon)
- `docs/CALL/FitVoyages x Poseidon Ledger - Meeting Playbook.docx`
- `docs/CALL/Poseidon Ledger x FitVoyages - Live Meeting Simulation.docx`
- `docs/CALL/poseidon-fitvoyages-meeting-playbook.docx`
- `src/lib/eu-ets/service.ts`, `types.ts`, `parameters.ts`, `port-classifier.ts`, `emissions.ts`
- `src/lib/fueleu/service.ts`, `parameters.ts`, `pooling.ts`
- `src/lib/mrv/service.ts`, `export.ts`
- `src/lib/supabase/demo-seed.ts`, `migrations/0001-0017`
- `src/constants/demo.ts`

### Web (FitVoyages + people) — accessed 30 Aug 2026
- https://fitvoyages.co/ (Home, Technology, Solutions)
- https://ae.linkedin.com/in/delstin-kuriakose (Delstin — Global Sales Manager, posts)
- https://www.linkedin.com/in/aswinanandpa (Aswin Anand — Co-Founder, Qubicle)
- https://www.linkedin.com/company/fit-voyages (company; size, founded 2024, Dubai)
- https://www.linkedin.com/posts/ashila-anil_* (Ashila Anil — VP Bus Dev)
- https://smartmaritimenetwork.com/2025/12/05/po-maritime-logistics-towage-fleet-to-deploy-maritime-iot-platform/ (P&O × Onboard; distinct from FitVoyages)
- https://thedigitalship.com/news/maritime-software/po-maritime-logistics-moves-on-digital-fleet-upgrade/
- https://www.maritimeinformed.com/news/maritime-logistics-fleet-connected-innovative-tool-co-1636535979-ga-npr.1666873357.html (P&O × Cat RFV)

### Regulatory context referenced
- EU ETS Directive 2003/87/EC as amended (2023/959); EU MRV Reg (EU) 2015/757; FuelEU Maritime Reg (EU) 2023/1805.
- Lloyd's Register VERS page (EUA/charter-party settlement + FuelEU reporting) — lr.org case study.
- The Ingeniat Maritime Compliance Dashboard article (adjacent product/benchmark PM context).

---

## 25. FACTS vs INFERENCE vs UNKNOWN

### VERIFIED (from project files / web)
- Poseidon's EU ETS scope logic (GT≥5000, MRV≥400), coverage factors (100/50/0), phase-in (40/70/100), deadlines (31 Mar / 30 Sep), baseline 91.16, reduction schedule, penalty €2400/tonne. `[SOURCE]` parameters.ts
- Poseidon seed: 5 vessels, Piraeus anchor, login `operator@poseidonledger.com`/`demo1234`, LIST of EU/third/non-EU port classifier. `[SOURCE]` demo-seed.ts, port-classifier.ts
- EU ETS v1 uses **equal distribution of CO₂ across voyages** (not per-voyage fuel). `[SOURCE]` eu-ets/service.ts
- No outbound webhook in Poseidon. `[SOURCE]` grep
- FitVoyages: white-label OSV monitoring, founded 2024, Dubai, ~3 staff, clamp-on ultrasonic + dashboard, "your servers" model, P&O on homepage. `[SOURCE]` fitvoyages.co, LinkedIn
- FitVoyages shows no EU ETS/FuelEU/THETIS-specific capability publicly. `[SOURCE]` site (absence)
- Delstin = Global Sales Manager, Dubai, ~3 months maritime, sales background. `[SOURCE]` LinkedIn

### INFERENCE
- FitVoyages has strong fuel-flow/shaft-power/mode/position data but weak EU-port classification, compliance factors, and alternative-fuel data.
- The room (as named in playbooks) is a technical feasibility evaluation; Mira/Theo are the pressure-testers.
- Meeting attendee roles may differ from playbook (Delstin is not founder).
- Greeks segment is Poseidon's *positioned* home, not a confirmed named customer.

### UNKNOWN / VERIFY (must confirm)
- Does a generic partner-vendor ingestion endpoint exist in Poseidon? (`[VERIFY]` — only MarineTraffic + email webhook found)
- Names/roles of actual FitVoyages attendees (are Mira/Theo real? Is Delstin in sales or founding?).
- Does FitVoyages have a real API / data-export for third parties?
- Does FitVoyages have any EU/EEA or Greek client / vessel making EU calls?
- Depth of FitVoyages historical data; shore-power capture; biofuel use.
- Strength of the FitVoyages–P&O relationship (P&O also works with Onboard/Cat/ABS).
- Whether an actual Greek prospect exists for a pilot.
- Poseidon's Monitoring Plan authoring support (`monitoring_plan_version` field exists; workflow extent unknown).

---

*End of brief. Use Section 15 for the demo, Section 16 for questions, Section 18 for phrases, Section 21 for commercial framing, Section 23 for the close.*
