# Poseidon Ledger — Regulatory Research Report

**Author:** Research Architect (Poseidon)
**Status:** Technical research only — no production code
**Scope:** IMO and adjacent regulatory frameworks relevant to Mediterranean superyacht fleet management
**Date:** 2026-07

---

## 0. How to read this report

For each regulation this report answers, in a fixed structure:

- **What it is** — the legal instrument, in-force date, what it regulates.
- **Superyacht applicability** — the single most important question. Most Mediterranean superyachts are **below 5,000 GT**, so the GT threshold and the "pleasure craft vs. commercial yacht" distinction are the gating facts. Throughout this report: **"pleasure craft not engaged in trade"** are largely outside the IMO regime; **commercial/charter yachts** are inside it.
- **Data / records required** — what a vessel must collect or carry.
- **APIs & portals** — whether an official digital interface exists. The recurring finding: **almost none of these regimes expose a public REST API.** Reporting is manual portal upload (THETIS, GISIS) or document/certificate-based via flag states and class societies.
- **Poseidon relevance** — why this product should care, mapping against what the codebase actually supports today.
- **Module sketch** — how it could become a Poseidon module later, what data it would need, and a difficulty/value rating.

### Project state assumed by this report

This report maps against the **current codebase reality**, not the architecture document's full vision:

- **Phase 1A (done):** `src/lib/marinetraffic/` — MarineTraffic client returning a domain `Voyage` (vessel name/IMO, departure/arrival port + timestamp, distance, source provenance). IMO checksum validation lives in `parse.ts:normalizeImo()`.
- **Phase 1B (done):** `src/lib/supabase/` — three repositories (`vessels`, `voyages`, `ais_positions`) over a Supabase Postgres schema (`supabase/migrations/0001_init_ais_schema.sql`). Tables are minimal: `vessels(id, imo, name, mmsi, ship_id, …)`, `voyages(vessel_id, ports, times, distance_nm, source_*)`, `ais_positions(vessel_id, ts, lat, lon, sog, cog, heading, nav_status)`.
- **Phase 1C (not started):** there is **no `src/app/` layer yet** — no REST API, no Zod validation, no orchestration. The repository layer is the only data-access surface today.
- The migration is deliberately scoped to **AIS ingestion only**. There are no tables for fuel deliveries, certificates, crew, ballast water, ETS records, etc. Any module that needs such data must add schema (a future-phase concern, not Phase 1C).

This matters because most regulations below require data Poseidon **does not yet collect** (fuel, certificates, crew, ballast). The report flags that honestly.

---

## 1. SOLAS — Safety of Life at Sea

### What it is
The **International Convention for the Safety of Life at Sea (SOLAS)**, 1974 (in force 1980), is the overarching IMO convention for ship construction, equipment, and safe operation. It has 14 Chapters; the most operationally relevant for Poseidon are:
- **Chapter V (Safety of navigation)** — includes the **AIS carriage requirement (Regulation 19)**.
- **Chapter IX (Management for the safe operation of ships)** — incorporates the **ISM Code** by reference (see §5).
- **Chapter I-2 / II-2** — fire safety, construction.
- **Chapter XI-2** — incorporates the **ISPS Code** (maritime security).

### Superyacht applicability
SOLAS applies to **passenger ships** and **cargo ships of 500 GT and above** engaged on international voyages. Pleasure craft are generally **outside** SOLAS. The critical carve-in for Poseidon's market: a **commercial/charter yacht** carrying up to 12 passengers and certified under a national **Commercial Yacht Code** (e.g., Red Ensign Group Yacht Code, Malta CYC, Large Commercial Yacht Code) is pulled into SOLAS-equivalent requirements via that code.

For **AIS specifically (Chapter V/19)**: AIS Class A is required on ships of **300 GT and above** on international voyages (500 GT for non-international). For yachts the practical rule reported by industry sources: **any yacht issued a Certificate of Compliance for a Large Charter Yacht must carry AIS regardless of operating area.** ([CISHipping](https://www.cishipping.com/do-yachts-over-300-gt-require-ais-accordance-solas-v19)). This is the legal backbone that makes **Poseidon's AIS-based product viable at all** — without AIS carriage there is no MarineTraffic data to ingest.

### Data / records required
Continuous synoptic records: safety equipment list, fire plans, stability information, navigational equipment certifications. For Poseidon's purposes the relevant artifact is the **AIS installation itself**, which generates the position/voyage data Poseidon consumes.

### APIs & portals
None public. SOLAS compliance is documented via **statutory certificates** issued by the flag state or a Recognised Organisation (class society: DNV, LR, RINA, BV, ABS). Vessel certificate status is queryable (for a fee) through class society portals and IHS Markit / S&P Global.

### Poseidon relevance — **foundational, indirect**
SOLAS Chapter V/19 is the **legal reason AIS exists on Poseidon's target vessels.** It is not itself a module; it is the precondition for the entire data model. No product change needed — but it belongs in the product's compliance "context" documentation and in any verifier-facing explanation of *why* AIS data is the primary source.

### Module sketch
**Not a module.** Difficulty: N/A. Value: foundational (enables everything else).

---

## 2. MARPOL — Prevention of Pollution from Ships

### What it is
The **International Convention for the Prevention of Pollution from Ships (MARPOL)**, 1973/78, has **six Annexes**:

| Annex | Covers | In force |
|---|---|---|
| I | Oil (oil pollution, IOPP Certificate) | 1983 |
| II | Noxious liquid substances in bulk | 1987 |
| III | Harmful substances in packaged form | 1992 |
| IV | Sewage | 2003 |
| V | Garbage | 1988 |
| **VI** | **Air pollution (SOx, NOx, CO₂, EEDI/EEXI/CII, DCS)** | **2005** |

**Annex VI is the dominant one for Poseidon** — it is the home of every emissions regulation in this report: the sulphur cap, Emission Control Areas, the IMO Data Collection System (DCS), EEXI, CII, and the NOx tiers.

### Key Annex VI facts
- **Global sulphur cap:** since **1 Jan 2020**, fuel oil sulphur content must be ≤ **0.50% m/m** outside ECAs ([IMO](https://www.imo.org/en/mediacentre/hottopics/pages/reducing-ship-emissions.aspx); [DNV](https://www.dnv.com/maritime/global-sulphur-cap/FAQ/)).
- **ECA sulphur limit:** ≤ **0.10% m/m** inside designated Emission Control Areas.
- **Mediterranean SOx ECA (Med SOx ECA):** entered into force **1 May 2025**, applying the 0.10% limit across the Mediterranean — i.e. **the entire operating area of Poseidon's target fleet** ([IMO](https://www.imo.org/en/mediacentre/pages/whatsnew-2254.aspx); [REMPEC guidance PDF](https://www.rempec.org/en/knowledge-centre/online-catalogue/e-med-sox-eca-regional-workshop-2024-draft-guidance-document-on-med-sox-eca.pdf)).
- **NOx tiers (Regulation 13):** Tier I/II/III limits; Tier III applies in NOx ECAs.

### Superyacht applicability
MARPOL applies to "ships" generally (with some size thresholds per Annex). The Med SOx ECA applies to **any ship operating in the Med**, including yachts, from 1 May 2025 — there is no yacht exemption for sulphur content inside an ECA. This is a near-universal compliance event for the fleet Poseidon serves.

### Data / records required
- Fuel oil sulphur content evidence (Bunker Delivery Notes — BDNs, which the architecture doc plans to ingest via OCR).
- IAPP (International Air Pollution Prevention) Certificate.
- For ≥5,000 GT: DCS data (see §9), EEXI file + IEEC, CII ratings + SEEMP Part III.

### APIs & portals
None public for MARPOL itself. Fuel sulphur data enters Poseidon through **BDNs** (a document OCR workflow, not an API). ECA boundaries are static geofences — no live API needed; the polygon data can be sourced from REMPEC/IMO publications.

### Poseidon relevance — **very high**
The Med SOx ECA (live since May 2025) makes fuel-sulphur compliance a **daily operational reality** for the entire Mediterranean fleet. This is the strongest near-term module candidate beyond the existing EU ETS / FuelEU work: a Green-Zone-style module that flags whether a vessel's last bunker meets 0.10% inside the Med ECA.

### Module sketch — "MARPOL Annex VI / ECA compliance"
- **What:** track each vessel's fuel sulphur evidence (from BDNs) against the 0.10% Med ECA limit; flag non-conforming bunkers before the vessel burns them in-zone.
- **Data required:** BDN sulphur field (already in the architecture's `fuel_deliveries` plan), vessel position (to confirm in-zone), Med ECA polygon.
- **APIs:** none needed; BDN OCR + static polygon.
- **Difficulty:** Medium (depends on the BDN/OCR pipeline, which is Phase 1+).
- **Business value:** **High** — every Med yacht is affected from May 2025; bunker-cost optimisation and penalty avoidance.

---

## 3. STCW — Seafarer Training & Certification

### What it is
The **International Convention on Standards of Training, Certification and Watchkeeping for Seafarers (STCW)**, 1978 (in force 1984), sets minimum competency standards for crews. Substantially revised in **1995** (introduced the STCW Code) and again by the **2010 Manila Amendments** (in force 1 Jan 2012, full transition by 1 Jan 2017). Certificates must be revalidated every **5 years** ([IMO STCW](https://www.imo.org/en/ourwork/humanelement/pages/stcw-convention.aspx); [UK MCA Manila guidance](https://www.gov.uk/guidance/manila-amendments-and-how-they-affect-seafarer-training-and-certificates)).

### Superyacht applicability
STCW applies to **seafarers on seagoing merchant ships** flagged to a Party — **commercial/charter yachts are in scope; private pleasure craft are generally out.** All paid crew on a commercial yacht operating internationally must hold, at minimum, **STCW Basic Safety Training**. Vessels over ~24 m trigger role-specific certificate requirements ([Superyacht Crew Academy](https://www.superyacht-crew-academy.com/stcw95/); [USCG STCW](https://www.dco.uscg.mil/nmc/STCW/)).

### Data / records required
Per-crew-member certificate inventory: BST, role-specific competence, medical fitness, security awareness (post-Manila), 5-year refresher dates. This is **HR-style data Poseidon does not collect today.**

### APIs & portals
None public. Flag-state maritime administrations (MCA, USCG, etc.) hold certificate records in national systems. No IMO-wide crew API.

### Poseidon relevance — **low to moderate**
STCW compliance is real but **outside Poseidon's core thesis** (which is voyage/emissions data, not crew management). The product would be duplicating dedicated crew-management tools.

### Module sketch — "Crew certification expiry tracker"
- **What:** track crew certificate expiry dates; alert before refreshers are due; flag a vessel as non-compliant if a key role lacks a valid certificate.
- **Data required:** crew roster + certificate list + issue/expiry dates (all new — no schema exists).
- **APIs:** none; manual entry or import from crew agencies.
- **Difficulty:** Low technically, **High data-acquisition friction** (operators must type it in).
- **Business value:** **Low–Moderate.** Better served by existing crew-management software; would dilute focus.

---

## 4. ISM Code — International Safety Management

### What it is
The **International Safety Management (ISM) Code**, mandatory via **SOLAS Chapter IX** since 1998/2002, requires a documented **Safety Management System (SMS)**, a company-level **Document of Compliance (DOC)**, and a per-vessel **Safety Management Certificate (SMC)**, audited periodically.

### Superyacht applicability
- **Commercial yachts ≥ 500 GT** on international voyages → **full ISM Code** (DOC + SMC + audited SMS).
- **Commercial yachts < 500 GT but > 24 m** → **"Mini ISM"** / scaled SMS (e.g., CYC §29.2). This covers the bulk of the 30–50 m superyacht segment ([Riela Yachts](https://riela-yachts.com/the-international-safety-management-ism-code/); [F3 Studio Mini-ISM](https://www.f3studio.it/en/mini-ism-for-superyachts-under-500-gt/); [Hill Robinson](https://hillrobinson.com/news/2023/why-every-superyacht-can-benefit-from-compliance-with-the-ism-code)).
- **Private yachts** → not legally required (voluntary best practice).

The architecture document already references **ISM Document of Compliance** (`organisations.ism_doc_number`) and **DPA** (Designated Person Ashore) — confirming ISM is in the product's conceptual frame.

### Data / records required
SMS documentation, DOC + SMC certificate numbers and expiry/audit dates, audit findings, DPA contact. The architecture doc's `organisations` table already plans `ism_doc_number`.

### APIs & portals
None public. DOC/SMC are issued by the flag state / RO and recorded in class-society systems.

### Poseidon relevance — **moderate**
ISM Doc-of-Compliance number is already a planned org field. The lighter opportunity is a **certificate-expiry tracker** (DOC/SMC audit due dates) — but the deeper SMS-document management is heavy and outside the emissions focus.

### Module sketch — "ISM certificate & audit tracker"
- **What:** track DOC/SMC validity and audit windows per vessel/org; alert the DPA before audits are due.
- **Data required:** certificate numbers + expiry + last-audit date (new table — `certificates`).
- **APIs:** none.
- **Difficulty:** Low.
- **Business value:** **Moderate** as part of a broader "compliance certificate registry," weak as a standalone.

---

## 5. Ballast Water Management Convention (BWM)

### What it is
The **International Convention for the Control and Management of Ships' Ballast Water and Sediments (BWM)**, 2004 (in force 2017), requires ships to manage ballast water to the **D-1 standard** (exchange) and ultimately the **D-2 standard** (treatment). **As of 8 September 2024, all ships in scope must meet D-2**, generally requiring an approved Ballast Water Management System (BWMS) ([IMO](https://www.imo.org/en/mediacentre/hottopics/pages/implementing-the-bwm-convention.aspx); [Gard](https://gard.no/en/insights/ballast-water-management-regulations-are-tightening/)).

### Superyacht applicability
**There is no blanket "pleasure craft" exemption.** Applicability is functional: ships **designed to carry ballast water** and on international voyages are in scope ([DNV BWM FAQ](https://www.dnv.com/maritime/ballast-water-management/frequently-asked-questions/); [ABS — Ballast Water Management for Yachts PDF](https://safety4sea.com/wp-content/uploads/2020/09/ABS-Ballast-Water-management-for-yachts-2020_08.pdf)).
- **Most small pleasure craft / yachts without ballast tanks → out of scope.**
- **Large superyachts ≥ 400 GT with ballast tanks on international voyages → in scope**, must carry a BWM Certificate and meet D-2.
- This is a **minority** of the Med superyacht fleet, but the largest vessels (>50 m) are affected.

### Data / records required
BWM Certificate, BWMS type-approval, ballast water record book (entries per operation), D-2 compliance date.

### APIs & portals
None public. Record-keeping is a paper/electronic logbook on board.

### Poseidon relevance — **low**
Touches only the largest end of the fleet and is operationally unrelated to emissions/voyages. Ballast water is not a data type AIS or MarineTraffic surfaces.

### Module sketch — "Ballast water record & certificate tracker"
- **What:** for the subset of large yachts with ballast tanks, track BWM Certificate expiry and D-2 compliance; optional ballast-operation log.
- **Data required:** vessel ballast-capacity flag + certificate dates (new schema).
- **APIs:** none.
- **Difficulty:** Low.
- **Business value:** **Low** — small addressable subset; not aligned with the emissions-data moat thesis.

---

## 6. Emission Control Areas (ECAs)

### What it is
**Emission Control Areas (ECAs)** are sea areas where stricter sulphur (0.10%) and, in some, NOx (Tier III) limits apply under MARPOL Annex VI Regulation 14. Existing ECAs: Baltic Sea, North Sea, North American ECA, US Caribbean ECA. **The Mediterranean Sea became a SOx ECA on 1 May 2025** ([IMO](https://www.imo.org/en/mediacentre/pages/whatsnew-2254.aspx)). (See §2 — ECAs are the MARPOL Annex VI mechanism; repeated here as a standalone because the brief lists it separately.)

### Poseidon relevance — **the highest-value Green Zone candidate**
The whole Mediterranean becoming an ECA on 1 May 2025 turns fuel-sulphur compliance from a niche concern into a **fleet-wide daily obligation** for every vessel Poseidon serves. Combined with the architecture doc's planned **Green Zone Compliance Module** (§2.11), this is the most natural extension of the current product.

### Module sketch — "ECA sulphur-conformance watch"
- **What:** for each vessel, confirm the most recent bunker's sulphur content is ≤0.10% when the vessel is operating inside the Med ECA polygon; flag exceptions for the compliance manager.
- **Data required:** BDN sulphur field (planned in `fuel_deliveries.sulphur_pct`), vessel position (`ais_positions` — **already exists**), Med ECA polygon (static).
- **APIs:** none (static geofence + existing AIS + planned BDN OCR).
- **Difficulty:** Medium (gated on the BDN pipeline).
- **Business value:** **High.**

---

## 7. Carbon Intensity Indicator (CII)

### What it is
The **Carbon Intensity Indicator (CII)**, under **MARPOL Annex VI Regulation 28** (revised 2021, in force 1 Jan 2023), rates the **operational** carbon intensity of ships **A–E** each calendar year. Ratings first assigned **2024** (from 2023 data). Ships rated **D for 3 consecutive years or E for 1 year** must develop a corrective action plan in **SEEMP Part III** ([DNV CII](https://www.dnv.com/maritime/insights/topics/CII-carbon-intensity-indicator/); [CarbonChain](https://www.carbonchain.com/blog/the-imo-carbon-intensity-indicator-cii-what-is-it-and-how-to-prepare); [Britannia P&I overview PDF](https://britanniapandi.com/wp-content/uploads/2025/06/Regulatory-Overview-of-Carbon-Intensity-Indicator-CII-and-Energy-Efficiency-Existing-Ship-Index-EEXI-June-2025.pdf)).

CII is computed as the vessel's annual emissions / transport work (roughly: a function of fuel consumed, distance travelled, and deadweight), normalised against reference lines.

### Superyacht applicability
CII applies to **cargo, RoPax, and cruise ships of 5,000 GT and above** on international voyages ([ciiratings.com](https://ciiratings.com/)). **Yachts are not in the CII ship-type scope** even if ≥5,000 GT. This is a key scope exclusion: CII is **not** a driver for the superyacht market Poseidon serves.

### APIs & portals
None public. CII ratings are verified by the ship's RO/flag state and submitted via the DCS path (see §9).

### Poseidon relevance — **low**
Out of scope for yachts. The **computation method** (fuel × distance normalisation) is conceptually adjacent to EU MRV, but the regulation itself does not bind Poseidon's customers.

### Module sketch
Not recommended as a standalone module. The CII *algorithm* may inform a future "vessel efficiency benchmark" analytics feature, but there is no compliance obligation to drive adoption. Difficulty: Medium. Value: **Low**.

---

## 8. Energy Efficiency Existing Ship Index (EEXI)

### What it is
The **EEXI**, under **MARPOL Annex VI Regulation 23/24** (in force 1 Jan 2023), is a **one-time technical** energy-efficiency certification for existing ships — an "EEDI for existing ships." A vessel that fails its required EEXI threshold must implement measures (e.g., engine power limitation) to comply. Certification yields the **IEEC (International Energy Efficiency Certificate)** at the first annual/intermediate/renewal survey on or after 1 Jan 2023 ([IMO EEXI/CII FAQ](https://www.imo.org/en/mediacentre/hottopics/pages/eexi-cii-faq.aspx); [DNV EEXI](https://www.dnv.com/maritime/insights/topics/eexi/)).

### Superyacht applicability
Per IMO, EEXI applies to ships of **400 GT and above** under MARPOL Annex VI Chapter 4 ship-type categories. **Yachts are generally not a listed EEXI ship type**, so like CII, EEXI is effectively **out of scope** for the superyacht fleet even where GT would otherwise qualify. (Sources differ on the exact threshold wording — 400 GT vs 5,000 GT — but the **ship-type exclusion for yachts is the decisive factor.**)

### Data / records required
Technical ship parameters (installed power, speed, capacity, fuel type) — all design-time, static. IEEC certificate number.

### APIs & portals
None public. EEXI is verified by class societies as a one-time technical calculation.

### Poseidon relevance — **low**
Not applicable to yachts. EEXI is design-data, not operational data — it would not benefit from Poseidon's AIS/voyage data at all.

### Module sketch
Not recommended. Difficulty: N/A. Value: **Low.**

---

## 9. IMO Data Collection System (DCS)

### What it is
The **IMO DCS**, **MARPOL Annex VI Regulation 22A (now Reg. 27)** (adopted MEPC.278(70), in force 1 March 2018, first reporting year **2019**), requires ships ≥5,000 GT to record and annually report **fuel oil consumption** (per fuel type, in tonnes) plus transport-work proxies (distance, hours underway) to their flag state/RO, verified against **SEEMP Part II**, with a **Statement of Compliance** issued ([IMO DCS](https://www.imo.org/en/ourwork/environment/pages/data-collection-system.aspx)). Amendments at MEPC 80 (2023) and MEPC 395(82) (2024) add transport-work detail and take effect **1 August 2025**.

### Superyacht applicability
**5,000 GT threshold** — the same line as EU MRV. Most Med superyachts are below it → **out of scope**. The few ≥5,000 GT commercial yachts are in scope, but this is a thin slice of the market.

### Poseidon relevance — **moderate (for the ≥5,000 GT segment)**
DCS is the IMO equivalent of EU MRV. For vessels in scope, Poseidon's voyage + fuel data is **exactly** the input DCS reporting needs. Where it differs from EU MRV: global scope (all international voyages, not just EEA-related) and IMO submission path (flag state, not THETIS).

### Module sketch — "DCS report packer"
- **What:** for ≥5,000 GT vessels, produce the annual DCS fuel-consumption + transport-work dataset in flag-state-acceptable format.
- **Data required:** per-fuel-type consumption (BDNs), distance travelled (AIS — **exists**), hours underway (AIS — derivable from `ais_positions`).
- **APIs:** none public (submission is to flag state/RO).
- **Difficulty:** Medium (reuses the BDN + AIS data model).
- **Business value:** **Moderate**, but only for the large-vessel subset. Best bundled with EU MRV reporting rather than sold separately.

---

## 10. EU ETS Maritime & EU MRV *(context — already a Poseidon core module)*

### What it is
- **EU MRV Shipping Regulation (2015/757)**: annual CO₂ monitoring/reporting/verification for ships ≥5,000 GT calling at EEA ports.
- **EU ETS extension to maritime (revised Directive 2003/87/EC, 2023)**: from 1 Jan 2024, ≥5,000 GT ships must surrender EU Allowances. **Phase-in: 40% of 2024 emissions (surrendered 2025), 70% of 2025 (2026), 100% of 2026 onward (2027).** Voyage scope: intra-EU 100%, EU–third-country 50% ([EU Climate Action](https://climate.ec.europa.eu/eu-action/transport-decarbonisation/reducing-emissions-shipping-sector_en); [DEHSt](https://www.dehst.de/EN/Topics/EU-ETS-1/Maritime-Transport/EU-ETS-1-Maritime-Transport/eu-ets-1-maritime-transport_node.html)). Reporting platform: **THETIS-MRV** (EMSA) — **no public API; manual XML/portal upload** (per the architecture doc §4.3).

### Poseidon relevance — **already core**
This is what Phase 1 exists to serve. The 5,000 GT scope line is the architecture doc's central design fact: most Med superyachts are below it → MRV monitoring still applies, but **EUA surrender does not**. The product correctly auto-derives scope from GT.

Not detailed further here — it is the implemented baseline, not new research.

---

## 11. FuelEU Maritime *(context — planned Poseidon module)*

### What it is
**Regulation (EU) 2023/1805**, in force **1 Jan 2025**, sets a declining **Well-to-Wake (WtW) GHG intensity** target for ship energy: **−2% vs the 91.16 gCO₂e/MJ 2020 baseline from 2025**, ramping to −6% (2030), −14.5% (2035), −31% (2040), −62% (2045), −80% (2050). Includes **pooling**, **OPS (shore-power) mandates at berth**, and **penalties** for non-compliance ([EC Transport](https://transport.ec.europa.eu/transport-modes/maritime/decarbonising-maritime-transport-fueleu-maritime_en); [DNV FuelEU](https://www.dnv.com/maritime/insights/topics/fueleu-maritime)).

### Poseidon relevance — **core (Phase 1 roadmap item)**
Already in the architecture (§2.8, §17.2) as a Phase-2 module. The data model needs WtW emission factors per fuel + ISCC biofuel certificates — all planned in the `fuel_deliveries` schema. Not new research.

---

## 12. Port State Control (Paris MoU)

### What it is
**Port State Control (PSC)** under the **Paris MoU** (27 maritime authorities, including all Med EU states) inspects foreign ships in port for compliance with the IMO conventions. The **New Inspection Regime (NIR)** classifies each ship **High / Standard / Low Risk (HRS/SRS/LRS)** via a **Ship Risk Profile** combining generic factors (age, type, flag performance) and inspection history. Inspection intervals: **HRS ~5–6 months, SRS ~10–12 months.** The central database is **THETIS**, hosted by EMSA, which continuously recomputes risk and alerts Port State Control Officers when an inspection is due ([Paris MoU — Ship Risk Profile](https://parismou.org/PMoU-Procedures/Library/ship-risk-profile); [Paris MoU — PSC Inspections](https://parismou.org/PMoU-Procedures/Lybrary/port-state-control-inspections-paris-mou); [EMSA NIR & THETIS](https://www.emsa.europa.eu/tags/download/471/464/23.html); [BIMCO Paris MoU guide PDF](https://www.bimco.org/media/hcofhkyh/inspection-regime-paris-mou-may2018.pdf)).

### Superyacht applicability
PSC applies to foreign commercial ships in port. **Charter/commercial yachts calling at Med ports are inspectable; private yachts are largely outside PSC scope** (flag-state jurisdiction instead). Deficiencies and detentions feed back into the Ship Risk Profile.

### APIs & portals
**THETIS is internal to PSC authorities — no public API.** The Paris MoU publishes aggregate annual reports and a ship-risk-profile calculator on its site, but no per-ship programmatic lookup. Inspection history is obtainable via class societies / Equasis (free portal, no API).

### Poseidon relevance — **moderate, as a risk/early-warning signal**
A PSC inspection readiness feature is a credible value-add: alert a fleet manager when a vessel is approaching its inspection window or has open deficiencies. But without a PSC data feed, Poseidon would rely on **operator-entered deficiency data** — high friction.

### Module sketch — "PSC inspection readiness"
- **What:** track each vessel's last inspection, open deficiencies, and estimated next-inspection window; provide a pre-inspection checklist.
- **Data required:** inspection history + deficiency list (operator-entered), vessel risk-profile inputs (age, flag, type — derivable).
- **APIs:** none public; Equasis manual export possible.
- **Difficulty:** Low technically, **High data friction.**
- **Business value:** **Moderate** — strongest where bundled with the Green Zone / port-call offering.

---

## 13. Vessel Identification: IMO Number, MMSI, AIS, LRIT, LOCODE

This section consolidates the identification standards the codebase already depends on, with applicability notes that directly affect data quality.

### 13.1 IMO Ship Identification Number
- **Format:** "IMO" + 7 digits. First six are sequential; **seventh is a check digit** computed as the units digit of Σ(digit_i × (7−i)) for i=0..5 (weights 7,6,5,4,3,2). Example IMO 9074729: 9×7+0×6+7×5+4×4+7×3+2×2 = 63+0+35+16+21+4 = 139 → check digit 9 ✓ ([IMO Ship Numbering FAQ PDF](https://wwwcdn.imo.org/localresources/en/OurWork/IIIS/Documents/IMO%2520Ship%2520&%2520Extension%2520FAQs.pdf); Resolution **A.1117(30)**).
- **Assignment:** by **S&P Global Market Intelligence** (formerly IHS Markit/Lloyd's Register-Fairplay) on behalf of IMO, via `imonumbers.ihs.com`. Processing ~5 working days. **No public API**; assignment is a request form.
- **Permanence:** assigned for the vessel's life; never reused; survives rename, sale, flag change, scrapping.
- **Superyacht applicability:** the scheme covers **pleasure yachts of 100 GT and above** — so **the Med superyacht fleet Poseidon targets is squarely within the IMO-numbered population.** This is the backbone of the codebase's identity model.
- **Poseidon implementation note:** the checksum is **already implemented and tested** in `src/lib/marinetraffic/parse.ts:normalizeImo()` (Phase 1A) and enforced at the DB layer by `vessels_imo_format` CHECK in the migration. This is the most production-ready piece of identity logic in the project.

### 13.2 MMSI (Maritime Mobile Service Identity)
- **Format:** 9 digits per ITU-R M.585. First 3 digits = **MID (Maritime Identification Digits)** = flag-state/country code; remaining 6 identify the station ([Wikipedia](https://en.wikipedia.org/wiki/Maritime_Mobile_Service_Identity); [FCC](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/maritime-mobile/ship-radio-stations/maritime-mobile)). Special formats exist for coast stations, SAR, and parent-ship-associated craft.
- **Relationship to IMO number:** IMO number is the **vessel's permanent identity**; MMSI is the **radio station identity**, which can change with flag re-registration. AIS broadcasts **both** (Class A); Class B broadcasts MMSI only.
- **Poseidon note:** the migration stores `mmsi` on `vessels` (nullable) but does not yet use it as a key. It is a candidate secondary key for AIS deduplication in a future phase.

### 13.3 AIS (Automatic Identification System)
- **Carriage (SOLAS V/19):** Class A required on ships **≥300 GT on international voyages** (≥500 GT domestic) and all passenger ships. Yachts under a Large Charter Yacht certificate must carry it ([CISHipping](https://www.cishipping.com/do-yachts-over-300-gt-require-ais-accordance-solas-v19)).
- **Class A vs B:** Class A (SOLAS ships) transmits full static + dynamic + voyage data at higher rate and reports **IMO number, destination, ETA**. Class B (smaller/non-SOLAS) has reduced reporting and **does not report IMO/destination/ETA** ([USCG NavCen AIS FAQ](https://www.navcen.uscg.gov/ais-frequently-asked-questions); [Wikipedia AIS](https://en.wikipedia.org/wiki/Automatic_identification_system)).
- **Poseidon note:** this Class A/B distinction matters for data completeness. MarineTraffic fuses both; Poseidon's domain `Voyage` (port pair, timestamps, distance) assumes Class-A-quality voyage fields. For Class-B-heavy sub-5000 GT yachts, voyage reconstruction will be noisier — an honest product caveat.

### 13.4 LRIT (Long-Range Identification and Tracking)
- Satellite-based **point-to-point** position reporting (~4-hourly) to flag/coastal states; distinct from AIS, which is a **VHF broadcast** ([Captain's Mode — LRIT vs AIS](https://captainsmode.com/differences-between-lrit-and-ais/)). **Closed system, no public access.** Not a Poseidon data source; MarineTraffic AIS is the product's choice, consistent with the architecture (§4.1, §11.5).

### 13.5 LOCODE (UN/LOCODE)
- Five-character UN location codes (2-letter country + 3-letter location, e.g., `FRNCE`) maintained by UNECE. The architecture (§9) uses LOCODE to classify voyages (intra-EU vs third-country) for EU ETS coverage rates. Source dataset: `github.com/datasets/un-locode` (offline import, no API needed).

---

## 14. Cross-cutting findings & recommendations

### 14.1 The recurring scope line: 5,000 GT
Almost every regulation in this report pivots on the **5,000 GT** boundary:
- **In scope (≥5,000 GT commercial):** EU ETS surrender, EU MRV, IMO DCS, CII. *(CII/DCS additionally exclude yachts by ship type.)*
- **Below 5,000 GT:** monitoring obligations may still apply (EU MRV), but surrender obligations do not. **Most Med superyachts sit here.**

Poseidon's architecture already encodes this (`vessels.ets_scope` auto-derived from GT ≥5000). The implication for future modules: **always design for both sides of the line** — the sub-5,000 GT majority still needs *monitoring* even when *surrender* doesn't apply.

### 14.2 The "no public API" reality
A decisive finding: **of all the regimes above, none expose a public REST API for reporting.** Submission paths are:
- **THETIS-MRV / THETIS:** EMSA-hosted, **manual XML/portal upload only** (architecture §4.3 — confirmed by research).
- **IMO DCS:** submission to flag state / RO (document-based).
- **GISIS:** IMO's internal database; **no public API**.
- **Equasis:** free vessel-history portal, **no API**.

**Implication:** Poseidon's value is not in *automated submission* (regulators don't allow it) but in **preparing submission-ready data packages** and **reducing verifier friction**. The architecture's "THETIS-MRV Export module generates a correctly formatted XML file for manual upload" (§4.3) is exactly right. This constraint should anchor every future module's scope.

### 14.3 What the current codebase can already support
- **IMO identity + checksum validation:** production-ready (`parse.ts`).
- **AIS-derived voyage reconstruction:** production-ready (Phase 1A client + Phase 1B `voyages` repository).
- **Vessel + position persistence:** production-ready (`vessels`, `ais_positions` repositories).

### 14.4 What no code exists for yet (module dependencies)
Every *compliance* module (ETS, FuelEU, DCS, ECA sulphur, PSC, ISM, STCW, BWM) needs **data types that have no tables yet**: fuel deliveries / BDNs, certificates, crew, emissions factors, Green Zone port requirements, audit log. The migration `0001` is intentionally AIS-only. The natural sequencing is:
1. **BDN / fuel pipeline** (OCR + `fuel_deliveries`) — unblocks FuelEU, EU ETS, ECA sulphur, DCS.
2. **Certificate registry** — unblocks ISM, BWM, a generic certificate-tracker.
3. **Green Zone port dataset** — unblocks ECA sulphur + port-call compliance.

### 14.5 Prioritisation for the Mediterranean superyacht market

Ranked by (business value × applicability breadth) for the *actual* fleet (mostly <5,000 GT, commercial charter, Med operating):

| Rank | Regulation | Why |
|---|---|---|
| 1 | **Med SOx ECA (MARPOL Annex VI)** | Affects **every** Med yacht since 1 May 2025; fuel-data-driven; natural Green Zone extension. |
| 2 | **EU MRV monitoring** (sub-5,000 GT) | Monitoring applies even when surrender doesn't; reuses AIS + fuel data. |
| 3 | **FuelEU Maritime** | Phase-2 roadmap; WtW data model already planned. |
| 4 | **ISM certificate tracker** | Light; org-level data; `ism_doc_number` already planned. |
| 5 | **PSC inspection readiness** | Value-add, but PSC data-feed friction is high. |
| 6 | **DCS (≥5,000 GT only)** | Thin segment; bundle with EU MRV. |
| 7 | **STCW crew tracker** | Off-thesis; better tools exist. |
| 8 | **Ballast water (large yachts only)** | Thin segment; off-thesis. |
| — | **CII / EEXI** | Out of scope for yachts. Skip. |

---

## Sources

**IMO & emissions**
- [IMO — Data Collection System (DCS)](https://www.imo.org/en/ourwork/environment/pages/data-collection-system.aspx)
- [IMO — Improving the energy efficiency of ships (SEEMP/EEXI/CII)](https://www.imo.org/en/ourwork/environment/pages/improving%2520the%2520energy%2520efficiency%2520of%2520ships.aspx)
- [IMO — EEXI & CII FAQ](https://www.imo.org/en/mediacentre/hottopics/pages/eexi-cii-faq.aspx)
- [IMO — Reducing ship emissions (sulphur cap)](https://www.imo.org/en/mediacentre/hottopics/pages/reducing-ship-emissions.aspx)
- [IMO — Mediterranean SOx ECA enters into force](https://www.imo.org/en/mediacentre/pages/whatsnew-2254.aspx)
- [IMO Ship Numbering FAQ (PDF)](https://wwwcdn.imo.org/localresources/en/OurWork/IIIS/Documents/IMO%2520Ship%2520&%2520Extension%2520FAQs.pdf)
- [DNV — Global Sulphur Cap 2020 FAQ](https://www.dnv.com/maritime/global-sulphur-cap/FAQ/)
- [DNV — CII insights](https://www.dnv.com/maritime/insights/topics/CII-carbon-intensity-indicator/)
- [DNV — EEXI guidance](https://www.dnv.com/maritime/insights/topics/eexi/)
- [DNV — FuelEU Maritime](https://www.dnv.com/maritime/insights/topics/fueleu-maritime)
- [REMPEC — Med SOx ECA Guidance (PDF)](https://www.rempec.org/en/knowledge-centre/online-catalogue/e-med-sox-eca-regional-workshop-2024-draft-guidance-document-on-med-sox-eca.pdf)
- [CarbonChain — IMO CII guide](https://www.carbonchain.com/blog/the-imo-carbon-intensity-indicator-cii-what-is-it-and-how-to-prepare)
- [ciiratings.com — CII ratings explained](https://ciiratings.com/)
- [Britannia P&I — CII & EEXI overview (PDF, June 2025)](https://britanniapandi.com/wp-content/uploads/2025/06/Regulatory-Overview-of-Carbon-Intensity-Indicator-CII-and-Energy-Efficiency-Existing-Ship-Index-EEXI-June-2025.pdf)
- [CE Delft — CII and EU maritime decarbonisation (PDF)](https://cedelft.eu/wp-content/uploads/sites/2/2023/06/CE_Delft_220400_CII_and_EU_maritime_decarbonisation_Def.pdf)

**EU ETS & FuelEU**
- [European Commission — Reducing emissions from shipping (EU ETS maritime)](https://climate.ec.europa.eu/eu-action/transport-decarbonisation/reducing-emissions-shipping-sector_en)
- [EC Transport — FuelEU Maritime](https://transport.ec.europa.eu/transport-modes/maritime/decarbonising-maritime-transport-fueleu-maritime_en)
- [DEHSt — EU-ETS maritime transport](https://www.dehst.de/EN/Topics/EU-ETS-1/Maritime-Transport/EU-ETS-1-Maritime-Transport/eu-ets-1-maritime-transport_node.html)
- [ClassNK — EU-ETS for Shipping FAQ (PDF)](https://download.classnk.or.jp/documents/EUETS_faq_e.pdf)

**Safety, certification & crew**
- [IMO — STCW Convention](https://www.imo.org/en/ourwork/humanelement/pages/stcw-convention.aspx)
- [UK MCA — Manila amendments guidance](https://www.gov.uk/guidance/manila-amendments-and-how-they-affect-seafarer-training-and-certificates)
- [Riela Yachts — ISM Code](https://riela-yachts.com/the-international-safety-management-ism-code/)
- [F3 Studio — Mini ISM for superyachts <500 GT](https://www.f3studio.it/en/mini-ism-for-superyachts-under-500-gt/)
- [Hill Robinson — ISM for superyachts](https://hillrobinson.com/news/2023/why-every-superyacht-can-benefit-from-compliance-with-the-ism-code)
- [Red Ensign Group — Yacht Code (REG YC, PDF)](https://www.redensigngroup.org/media/yzlbtkyi/reg-yc-july-2024-edition-part-a.pdf)
- [Transport Malta — Commercial Yacht Code 2020 (PDF)](https://www.transport.gov.mt/CYC-2020.pdf-f5742)
- [CISHipping — Yachts >300 GT AIS under SOLAS V/19](https://www.cishipping.com/do-yachts-over-300-gt-require-ais-accordance-solas-v19)

**Port State Control & ballast water**
- [Paris MoU — Ship Risk Profile](https://parismou.org/PMoU-Procedures/Library/ship-risk-profile)
- [Paris MoU — PSC Inspections](https://parismou.org/PMoU-Procedures/Lybrary/port-state-control-inspections-paris-mou)
- [Paris MoU — Selection Scheme](https://parismou.org/PMoU-Procedures/Library/selection-scheme)
- [EMSA — NIR and THETIS](https://www.emsa.europa.eu/tags/download/471/464/23.html)
- [BIMCO — Inspection Regime Paris MoU (PDF)](https://www.bimco.org/media/hcofhkyh/inspection-regime-paris-mou-may2018.pdf)
- [IMO — Implementing the BWM Convention](https://www.imo.org/en/mediacentre/hottopics/pages/implementing-the-bwm-convention.aspx)
- [Gard — Ballast water management regulations tightening](https://gard.no/en/insights/ballast-water-management-regulations-are-tightening/)
- [DNV — BWM FAQ](https://www.dnv.com/maritime/ballast-water-management/frequently-asked-questions/)
- [ABS — Ballast Water Management for Yachts (PDF)](https://safety4sea.com/wp-content/uploads/2020/09/ABS-Ballast-Water-management-for-yachts-2020_08.pdf)

**Identification & AIS**
- [Wikipedia — Maritime Mobile Service Identity (MMSI)](https://en.wikipedia.org/wiki/Maritime_Mobile_Service_Identity)
- [FCC — Maritime Mobile Service Identities (MMSI)](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/maritime-mobile/ship-radio-stations/maritime-mobile)
- [USCG NavCen — AIS FAQ](https://www.navcen.uscg.gov/ais-frequently-asked-questions)
- [USCG NavCen — MMSIs for craft associated with a parent ship](https://www.navcen.uscg.gov/mmsis-for-craft-associated-with-a-parent-ship-launches-etc)
- [Wikipedia — Automatic Identification System (AIS)](https://en.wikipedia.org/wiki/Automatic_identification_system)
- [Captain's Mode — LRIT vs AIS](https://captainsmode.com/differences-between-lrit-and-ais/)

---

*End of regulatory research report. No production code was written. This document is research input only; it does not alter any Phase 1 work.*
