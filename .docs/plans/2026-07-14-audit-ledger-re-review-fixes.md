# Audit Ledger Re-review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make audit pagination reversible without unbounded cursor history, preserve stored UTF-8
bytes exactly, and keep every export within Cloudflare D1 Free invocation limits.

**Architecture:** A canonical v2 cursor binds snapshot, limit, filters, and bounded source/target
ranges. Read projections validate SQLite storage classes and decode allowlisted text from BLOB bytes
with fatal UTF-8. Export combines compact descriptor and normal HEX payloads in one positional raw
query, then globally batches all segmented chunks with a fixed one-bind plan.

**Tech Stack:** TypeScript, Bun test, Hono, Cloudflare Workers/D1, SQLite, Zod.

## Global Constraints

- D1 Free permits at most 50 queries per Worker invocation; repository export targets at most 25.
- D1 strings, BLOBs, and rows are at most 2,000,000 bytes.
- Text payloads cross the D1 boundary only as uppercase HEX; no runtime-specific BLOB shape is used.
- Cursor state is bounded, canonical, position-only, and never authorization data.
- Immediate opposite navigation restores the exact source range. Deeper reverse navigation may
  regroup pages but must remain contiguous without skips or overlap; Task 8 keeps the browser stack
  for exact historical grouping.

---

### Task 1: Cursor v2 and variable-width pagination

**Files:**

- Modify: `api/src/lib/audit/audit-cursor.ts`
- Modify: `api/src/lib/audit/audit-cursor.test.ts`
- Modify: `api/src/infrastructure/audit/audit-event-repository.ts`
- Test: `api/src/infrastructure/audit/audit-event-repository.test.ts`
- Modify: `.superpowers/sdd/task-4-brief.md`

**Interfaces:**

- Consumes: stable `(created_at, id)` ordering and `AuditEventFilters`.
- Produces: canonical v2 cursor bound to snapshot max ID, limit, filter fingerprint, and bounded
  source/target ranges.

- [x] Add RED tests for the 400-row variable-width fixture, immediate exact previous restoration,
      deep contiguous navigation, changed filter/limit rejection, and appended-newer exclusion.
- [x] Run the focused cursor/repository tests and record the expected overlap failures.
- [x] Implement v2 cursor parsing/encoding and descriptor range verification with bound SQL.
- [x] Re-run the focused tests until GREEN.

### Task 2: Byte-faithful UTF-8 reads

**Files:**

- Modify: `api/src/infrastructure/audit/audit-event-repository.ts`
- Test: `api/src/infrastructure/audit/audit-event-repository.test.ts`

**Interfaces:**

- Consumes: D1 `typeof(column)` and BLOB/HEX projections.
- Produces: exact stored text or safe `503 audit_unavailable`; never replacement decoding or type
  coercion.

- [x] Add RED fixtures for `CAST(X'80' AS TEXT)`, same-length replacement adversaries, numeric/BLOB
      storage corruption, BOM, valid Unicode, and malformed JSON across summary/detail families.
- [x] Run the focused repository tests and record modified-text leakage.
- [x] Implement storage-class validation and fatal UTF-8 decode for normal and large reads.
- [x] Re-run the focused tests until GREEN.

### Task 3: D1 Free export query budget and remote-valid limits

**Files:**

- Modify: `api/src/infrastructure/audit/audit-event-repository.ts`
- Test: `api/src/infrastructure/audit/audit-event-repository.test.ts`
- Modify: `.docs/plans/2026-07-14-audit-ledger-design.md`
- Modify: `.docs/plans/2026-07-14-audit-ledger-implementation.md`
- Modify: `.superpowers/sdd/task-3-report.md`

**Interfaces:**

- Consumes: descriptor-first export and 16 MiB CSV byte counter.
- Produces: 50,000-row success and remote-valid stress paths within 25 repository D1 calls.

- [x] Add RED query-count assertions for 50,000 rows, row 50,001, and worst remote-valid large rows.
- [x] Run the focused repository test and record the current 201-query result.
- [x] Raise the descriptor window to 5,000 while preserving cumulative raw/wire guards and exact-ID
      chunk safety.
- [x] Replace decisive over-2MB fixtures with per-row values below 2,000,000 bytes and retain any
      larger local-only stress with an explicit label.
- [x] Add formal RED fixtures for 1,000,002-byte metadata times sixteen, 1,998,002-byte metadata
      times eight, and fourteen segmented rows mixed with 46,000 tiny rows; record 34/26/49 calls.
- [x] Return normal HEX in the compact descriptor statement and batch segment plans globally at
      1,998,000 source bytes per query with one JSON bind and fixed allowlisted column cases.
- [x] Validate ordinal, identity, actor, storage class, full/chunk length, missing, duplicate,
      reordered, invalid HEX and same-length invalid UTF-8 responses; retain append-only triggers as
      the documented trust boundary for a same-length valid rewrite between segment queries.
- [x] Prove query counts 11/11/19 for the three formal fixtures, 11 for 50,000 rows and row 50,001,
      and exact 16 MiB/+1 byte behavior using nine remote-compatible rows below 2 MB each.
- [x] Decode exact rows inside each 5,000-row window and discard HEX/layout immediately; retain only
      final rows and segmented state, with the 50,000-row retained-memory delta below 64 MiB.
- [ ] Run focused tests, full API tests, API typecheck, `vp check`, diff/hygiene, then commit and push.
