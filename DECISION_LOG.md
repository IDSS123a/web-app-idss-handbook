# DECISION_LOG.md — Project-Specific Decisions
# IDSS Handbook Web Application
# Version 1.0 — June 2026

---

> Project-specific decisions only.
> Universal decisions (ORM, deployment, state management) are in:
> https://raw.githubusercontent.com/IDSS123a/commander/main/DECISION_LOG.md

---

## DL-P-001 — AI Generation Model: gemini-2.5-flash

**Date:** 2026-06-28
**Decision:** Use `gemini-2.5-flash` as the exact generation model string.
**Rationale:** This is the only Gemini model string confirmed to work with the
8-key free-tier rotation system. All other model strings (including `gemini-2.0-flash`
and variants) cause errors. This string is locked and must not be changed by any ACA.

---

## DL-P-002 — 8 Gemini Free-Tier Keys for Rate Limit Distribution

**Date:** 2026-06-28
**Decision:** Use 8 separate free-tier Gemini API keys in round-robin rotation.
**Rationale:** Each free key provides ~15 RPM. 8 keys = ~120 RPM effective throughput,
sufficient for institutional use with teachers using the system concurrently.
This avoids paid API tiers while maintaining reliable performance.

---

## DL-P-003 — Trophy.so vs Custom Gamification

**Date:** 2026-06-28
**Decision:** Implement gamification with Trophy.so (100 MAU free) as first option.
If Trophy.so limits are reached or integration is too complex, fall back to custom
Supabase implementation using `user_points` and `user_badges` tables.
**Rationale:** Trophy.so reduces implementation time. Custom is always available as fallback.

---

## DL-P-004 — OCR.Space 1MB Limit Mitigation

**Date:** 2026-06-28
**Decision:** For PDFs exceeding 1MB, implement a pre-processing step that splits
the PDF into chunks under 1MB before sending to OCR.Space.
**Rationale:** OCR.Space free tier has a 1MB per file limit. School PDFs (scanned
regulations, procedures) may exceed this. Splitting is simpler than switching providers.
**Upgrade path:** If splitting proves unreliable, migrate to Docling with Python infrastructure.

---

## DL-P-005 — No Magic Links or OAuth for Authentication

**Date:** 2026-06-28
**Decision:** Email + password authentication only. No OAuth, no magic links.
**Rationale:** This is a closed institutional system. All users must be manually approved
by the Director. Magic links and OAuth create automatic access paths that bypass the
manual approval workflow, which is institutionally unacceptable.

---

*IDSS Handbook Decision Log v1.0 — P.U. IDSS Sarajevo*
