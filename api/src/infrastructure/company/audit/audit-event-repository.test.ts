import { describe, expect, test } from "bun:test"
import type { AuditEventDetail, AuditEventRecord } from "@/composition/audit/audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/infrastructure/company/audit/audit-event-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { AuditCursor } from "@/lib/audit/audit-cursor"
import { toAuditCsv } from "@/lib/audit/to-audit-csv"
import { AUDIT_CSV_MAX_BYTES } from "@/lib/audit/to-audit-csv-row"
import { PayloadTooLargeError, UnavailableError, ValidationError } from "@/lib/errors"
import { schema } from "@/schema"
import { drizzle } from "drizzle-orm/d1"

const LARGE_STRESS_TEST_TIMEOUT_MS = 60_000

function record(overrides: Partial<AuditEventRecord> = {}): AuditEventRecord {
  return {
    eventId: "event-1",
    requestId: "00000000-0000-4000-8000-000000000001",
    actorAccountId: 7,
    actorEmployeeId: 11,
    action: "iam.role.updated",
    targetType: "role",
    targetId: "security-reviewer",
    outcome: "succeeded",
    reasonCode: "role_updated",
    authorizationJson: '{"permission":"iam:role:update"}',
    beforeJson: '{"name":"before"}',
    afterJson: '{"name":"after"}',
    metadataJson: '{"source":"test"}',
    clientIp: "192.0.2.7",
    clientName: "cli",
    createdAt: 1_700_000_000,
    ...overrides,
  }
}

async function expectAuditUnavailable(promise: Promise<unknown>): Promise<void> {
  try {
    await promise
    throw new Error("expected audit repository rejection")
  } catch (error) {
    expect(error).toBeInstanceOf(UnavailableError)
    expect((error as UnavailableError).code).toBe("audit_unavailable")
    expect((error as UnavailableError).message).toBe("audit events are unavailable")
    expect((error as UnavailableError).message).not.toContain("audit_logs")
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }

  throw new Error("expected promise rejection")
}

async function insertLegacyRow(
  db: D1Database,
  overrides: {
    id?: number
    eventId?: string
    action?: string
    targetType?: string | null
    targetId?: string | null
    reasonCode?: string | null
    actorAccountId?: number | string | null
    authorizationJson?: string | null
    beforeJson?: string | null
    afterJson?: string | null
    metadataJson?: string | null
    clientIp?: string | null
    createdAt?: number | string
  } = {},
): Promise<void> {
  const id = overrides.id ?? -1
  await db
    .prepare(
      `INSERT INTO audit_events
         (id, event_id, request_id, actor_account_id, action,
          target_type, target_id, outcome, reason_code, authorization_json,
          before_json, after_json, metadata_json, client_ip, client_name, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'succeeded', ?8, ?9,
               ?10, ?11, ?12, ?13, 'api', ?14)`,
    )
    .bind(
      id,
      overrides.eventId ?? `legacy-${id}`,
      `legacy-request-${id}`,
      overrides.actorAccountId === undefined ? 7 : overrides.actorAccountId,
      overrides.action ?? "legacy.unknown.action",
      overrides.targetType === undefined ? "legacy_target" : overrides.targetType,
      overrides.targetId === undefined ? `legacy-${id}` : overrides.targetId,
      overrides.reasonCode === undefined ? "legacy_reason" : overrides.reasonCode,
      overrides.authorizationJson === undefined
        ? '{"scope":"legacy"}'
        : overrides.authorizationJson,
      overrides.beforeJson === undefined ? '{"state":"before"}' : overrides.beforeJson,
      overrides.afterJson === undefined ? '{"state":"after"}' : overrides.afterJson,
      overrides.metadataJson === undefined ? '{"note":"legacy"}' : overrides.metadataJson,
      overrides.clientIp === undefined ? "198.51.100.7" : overrides.clientIp,
      overrides.createdAt ?? 1_700_000_000,
    )
    .run()
  await db
    .prepare(
      `INSERT INTO audit_event_employee_contexts (audit_event_id, employee_id)
       VALUES (?1, 11)`,
    )
    .bind(id)
    .run()
}

function createCountingContext(): {
  context: Context
  db: D1Database
  queryCount: () => number
} {
  let count = 0
  const db = createD1TestDatabase(loadSchema(), { onQuery: () => (count += 1) })
  const context: Context = {
    var: {
      database: drizzle(db, { schema }),
      session: null,
      auditContext: {
        requestId: "00000000-0000-4000-8000-000000000000",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
    env: {
      DB: db,
      JWT_SECRET: "repository-test-secret",
      AUDIT_HMAC_SECRET: "repository-test-audit-hmac-secret",
    },
  }

  return { context, db, queryCount: () => count }
}

type ObservedAllRead = {
  sql: string
  rowCount: number
  payloadBytes: number
  maxRowPayloadBytes: number
  bindingCount: number
  maxBindingBytes: number
}

function observeAllReads(context: Context): ObservedAllRead[] {
  const reads: ObservedAllRead[] = []
  const source = context.env.DB
  const encoder = new TextEncoder()

  const wrapStatement = (
    statement: D1PreparedStatement,
    sql: string,
    bindings: ReadonlyArray<unknown> = [],
  ): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property) {
        if (property === "bind") {
          return (...values: unknown[]) => wrapStatement(target.bind(...values), sql, values)
        }
        if (property === "all") {
          return async () => {
            const result = await target.all()
            reads.push({
              sql,
              rowCount: result.results.length,
              payloadBytes: encoder.encode(JSON.stringify(result.results)).byteLength,
              maxRowPayloadBytes: Math.max(
                0,
                ...result.results.map((row) => encoder.encode(JSON.stringify(row)).byteLength),
              ),
              bindingCount: bindings.length,
              maxBindingBytes: Math.max(
                0,
                ...bindings.map(
                  (value) =>
                    encoder.encode(typeof value === "string" ? value : JSON.stringify(value))
                      .byteLength,
                ),
              ),
            })
            return result
          }
        }
        if (property === "raw") {
          return async () => {
            const result = await target.raw()
            reads.push({
              sql,
              rowCount: result.length,
              payloadBytes: encoder.encode(JSON.stringify(result)).byteLength,
              maxRowPayloadBytes: Math.max(
                0,
                ...result.map((row) => encoder.encode(JSON.stringify(row)).byteLength),
              ),
              bindingCount: bindings.length,
              maxBindingBytes: Math.max(
                0,
                ...bindings.map(
                  (value) =>
                    encoder.encode(typeof value === "string" ? value : JSON.stringify(value))
                      .byteLength,
                ),
              ),
            })
            return result
          }
        }

        const value = Reflect.get(target, property, target) as unknown
        return typeof value === "function" ? value.bind(target) : value
      },
    })

  context.env.DB = new Proxy(source, {
    get(target, property) {
      if (property === "prepare") {
        return (sql: string) => wrapStatement(target.prepare(sql), sql)
      }

      const value = Reflect.get(target, property, target) as unknown
      return typeof value === "function" ? value.bind(target) : value
    },
  })

  return reads
}

function enforceD1ReadResultLimits(context: Context): ObservedAllRead[] {
  const reads: ObservedAllRead[] = []
  const source = context.env.DB
  const encoder = new TextEncoder()

  const observe = (sql: string, rows: ReadonlyArray<unknown>, bindings: ReadonlyArray<unknown>) => {
    const read = {
      sql,
      rowCount: rows.length,
      payloadBytes: encoder.encode(JSON.stringify(rows)).byteLength,
      maxRowPayloadBytes: Math.max(
        0,
        ...rows.map((row) => encoder.encode(JSON.stringify(row)).byteLength),
      ),
      bindingCount: bindings.length,
      maxBindingBytes: Math.max(
        0,
        ...bindings.map(
          (value) =>
            encoder.encode(typeof value === "string" ? value : JSON.stringify(value)).byteLength,
        ),
      ),
    }
    reads.push(read)
    if (read.maxRowPayloadBytes >= 2_000_000) {
      throw new Error("simulated D1 result row limit")
    }
    if (read.payloadBytes > 4 * 1024 * 1024) {
      throw new Error("simulated D1 result payload limit")
    }
  }

  const wrapStatement = (
    statement: D1PreparedStatement,
    sql: string,
    bindings: ReadonlyArray<unknown> = [],
  ): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property) {
        if (property === "bind") {
          return (...values: unknown[]) => wrapStatement(target.bind(...values), sql, values)
        }
        if (property === "all") {
          return async () => {
            const result = await target.all()
            observe(sql, result.results, bindings)
            return result
          }
        }
        if (property === "raw") {
          return async () => {
            const result = await target.raw()
            observe(sql, result, bindings)
            return result
          }
        }

        const value = Reflect.get(target, property, target) as unknown
        return typeof value === "function" ? value.bind(target) : value
      },
    })

  context.env.DB = new Proxy(source, {
    get(target, property) {
      if (property === "prepare") {
        return (sql: string) => wrapStatement(target.prepare(sql), sql)
      }

      const value = Reflect.get(target, property, target) as unknown
      return typeof value === "function" ? value.bind(target) : value
    },
  })

  return reads
}

function tamperSegmentRead(
  context: Context,
  mode:
    | "failure"
    | "missing"
    | "duplicate"
    | "reordered"
    | "changed-id"
    | "changed-created-at"
    | "changed-actor"
    | "changed-storage"
    | "changed-length"
    | "invalid-hex"
    | "invalid-utf8",
): void {
  const source = context.env.DB
  let tampered = false
  let segmentReadCount = 0

  const wrapStatement = (statement: D1PreparedStatement, sql: string): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property) {
        if (property === "bind") {
          return (...values: unknown[]) => wrapStatement(target.bind(...values), sql)
        }
        if (property === "all") {
          return async () => {
            const result = await target.all()
            if (!sql.includes("hex(substr")) return result
            segmentReadCount += 1
            if (tampered || segmentReadCount !== 1) return result
            tampered = true

            if (mode === "failure") return { ...result, success: false }
            if (mode === "missing") return { ...result, results: [] }

            const [first, ...rest] = result.results
            if (typeof first !== "object" || first === null) return { ...result, results: [] }
            const row = first as Record<string, unknown>
            const chunkKey = Object.keys(row).find((key) => key.endsWith("_chunk_hex"))
            const chunkHex = chunkKey === undefined ? undefined : row[chunkKey]
            if (typeof chunkHex !== "string" || chunkHex.length < 2) {
              return { ...result, results: [] }
            }
            if (mode === "changed-id" || mode === "changed-created-at") {
              const field = mode === "changed-id" ? "id" : "created_at"
              const value = row[field]
              return {
                ...result,
                results: [
                  { ...row, [field]: typeof value === "number" ? value + 1 : "changed" },
                  ...rest,
                ],
              }
            }
            return {
              ...result,
              results: [
                {
                  ...row,
                  [chunkKey as string]: `${mode === "invalid-hex" ? "GG" : "80"}${chunkHex.slice(2)}`,
                },
                ...rest,
              ],
            }
          }
        }
        if (property === "raw") {
          return async () => {
            const result = await target.raw()
            if (!sql.includes("hex(substr")) return result
            segmentReadCount += 1
            if (tampered || segmentReadCount !== 1) return result
            tampered = true

            if (mode === "failure") throw new Error("simulated segment read failure")
            if (mode === "missing") return result.slice(1)
            if (mode === "duplicate") return result.length === 0 ? result : [result[0], ...result]
            if (mode === "reordered") {
              return result.length < 2 ? result : [result[1], result[0], ...result.slice(2)]
            }

            const [first, ...rest] = result
            if (!Array.isArray(first) || first.length !== 12) return []
            const row = [...first]
            if (mode === "changed-id" || mode === "changed-created-at") {
              const field = mode === "changed-id" ? 2 : 3
              row[field] = typeof row[field] === "number" ? row[field] + 1 : "changed"
            } else if (mode === "changed-actor") {
              row[4] = typeof row[4] === "number" ? row[4] + 1 : 1
            } else if (mode === "changed-storage") {
              row[9] = "blob"
            } else if (mode === "changed-length") {
              row[10] = typeof row[10] === "number" ? row[10] + 1 : 1
            } else {
              const chunkHex = row[11]
              if (typeof chunkHex !== "string" || chunkHex.length < 2) return []
              row[11] = `${mode === "invalid-hex" ? "GG" : "80"}${chunkHex.slice(2)}`
            }
            return [row, ...rest]
          }
        }

        const value = Reflect.get(target, property, target) as unknown
        return typeof value === "function" ? value.bind(target) : value
      },
    })

  context.env.DB = new Proxy(source, {
    get(target, property) {
      if (property === "prepare") {
        return (sql: string) => wrapStatement(target.prepare(sql), sql)
      }

      const value = Reflect.get(target, property, target) as unknown
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

function tamperExactRead(context: Context, mode: "changed-actor" | "changed-length"): void {
  const source = context.env.DB
  let tampered = false

  const wrapStatement = (statement: D1PreparedStatement, sql: string): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property) {
        if (property === "bind") {
          return (...values: unknown[]) => wrapStatement(target.bind(...values), sql)
        }
        if (property === "all") {
          return async () => {
            const result = await target.all()
            if (
              tampered ||
              !sql.includes("WHERE id IN (SELECT value FROM json_each(?1))") ||
              result.results.length === 0
            ) {
              return result
            }
            tampered = true
            const [first, ...rest] = result.results
            if (typeof first !== "object" || first === null || Array.isArray(first)) return result
            const row = { ...first } as Record<string, unknown>
            if (mode === "changed-actor") {
              row.actor_account_id = typeof row.actor_account_id === "number" ? 8 : 1
            } else {
              const valueKey =
                typeof row.metadata_json_value === "string"
                  ? "metadata_json_value"
                  : "target_id_value"
              const value = row[valueKey]
              if (typeof value !== "string") return result
              row[valueKey] = `${value}20`
            }
            return { ...result, results: [row, ...rest] }
          }
        }

        const value = Reflect.get(target, property, target) as unknown
        return typeof value === "function" ? value.bind(target) : value
      },
    })

  context.env.DB = new Proxy(source, {
    get(target, property) {
      if (property === "prepare") {
        return (sql: string) => wrapStatement(target.prepare(sql), sql)
      }
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

async function insertBulkRows(db: D1Database, count: number): Promise<void> {
  await db.exec(`
    WITH RECURSIVE sequence(value) AS (
      SELECT 1
      UNION ALL
      SELECT value + 1 FROM sequence WHERE value < ${count}
    )
    INSERT INTO audit_events
      (id, event_id, request_id, action, outcome, client_name, created_at)
    SELECT value, 'bulk-' || value, 'bulk-request-' || value,
           'legacy.bulk', 'succeeded', 'api', value
    FROM sequence
  `)
}

async function insertMinimalRemoteMetadataRows(
  db: D1Database,
  options: {
    firstId: number
    count: number
    metadataJson: string
    createdAtOffset?: number
  },
): Promise<void> {
  const statement = db.prepare(
    `INSERT INTO audit_events
       (id, event_id, request_id, action, outcome, metadata_json, client_name, created_at)
     VALUES (?1, ?2, 'r', 'a', 'succeeded', ?3, 'api', ?4)`,
  )
  for (let index = 0; index < options.count; index += 1) {
    const id = options.firstId + index
    await statement
      .bind(id, `l${id}`, options.metadataJson, (options.createdAtOffset ?? 0) + id)
      .run()
  }
}

async function insertMinimalTinyRows(
  db: D1Database,
  options: { firstId: number; count: number },
): Promise<void> {
  const lastId = options.firstId + options.count - 1
  await db.exec(`
    WITH RECURSIVE sequence(value) AS (
      SELECT ${options.firstId}
      UNION ALL
      SELECT value + 1 FROM sequence WHERE value < ${lastId}
    )
    INSERT INTO audit_events
      (id, event_id, request_id, action, outcome, client_name, created_at)
    SELECT value, CAST(value AS TEXT), 'r', 'a', 'succeeded', 'api', value
    FROM sequence
  `)
}

async function insertWideSummaryRows(
  db: D1Database,
  count: number,
  targetIdBytes: number,
): Promise<void> {
  await db
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1
         UNION ALL
         SELECT value + 1 FROM sequence WHERE value < ?1
       )
       INSERT INTO audit_events
         (id, event_id, request_id, action, target_type, target_id,
          outcome, client_name, created_at)
       SELECT value, 'wide-' || value, 'wide-request-' || value,
              'legacy.wide', 'legacy_target', lower(hex(zeroblob(?2))),
              'succeeded', 'api', 100
       FROM sequence`,
    )
    .bind(count, Math.ceil(targetIdBytes / 2))
    .run()
}

async function insertMixedWidthSameSecondRows(db: D1Database, count: number): Promise<void> {
  await db
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1
         UNION ALL
         SELECT value + 1 FROM sequence WHERE value < ?1
       )
       INSERT INTO audit_events
         (id, event_id, request_id, action, target_type, target_id,
          outcome, client_name, created_at)
       SELECT value, 'mixed-' || value, 'mixed-request-' || value,
              'legacy.mixed', 'legacy_target',
              lower(hex(zeroblob(CASE value % 7
                WHEN 0 THEN 175000
                WHEN 1 THEN 250
                WHEN 2 THEN 90000
                WHEN 3 THEN 1500
                WHEN 4 THEN 45000
                WHEN 5 THEN 8000
                ELSE 600
              END))),
              'succeeded', 'api', 100
       FROM sequence`,
    )
    .bind(count)
    .run()
}

const AUDIT_TEXT_COLUMNS = [
  "event_id",
  "request_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "reason_code",
  "authorization_json",
  "before_json",
  "after_json",
  "metadata_json",
  "client_ip",
  "client_name",
] as const

type AuditTextColumn = (typeof AUDIT_TEXT_COLUMNS)[number]
const AUDIT_SUMMARY_TEXT_COLUMNS = new Set<AuditTextColumn>([
  "event_id",
  "request_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "reason_code",
  "client_name",
])

async function readStoredAuditRowMetrics(
  db: D1Database,
  eventId: string,
): Promise<{ storedBytes: number; maxTextBytes: number; exactHexPayloadBytes: number }> {
  const textByteExpressions = AUDIT_TEXT_COLUMNS.map(
    (column) => `CASE WHEN ${column} IS NULL THEN 0 ELSE length(CAST(${column} AS BLOB)) END`,
  )
  const result = await db
    .prepare(
      `SELECT (${textByteExpressions.join(" + ")} +
                length(CAST(id AS BLOB)) +
                CASE WHEN actor_account_id IS NULL THEN 0
                     ELSE length(CAST(actor_account_id AS BLOB)) END +
                CASE WHEN actor_employee_id IS NULL THEN 0
                     ELSE length(CAST(actor_employee_id AS BLOB)) END +
                length(CAST(created_at AS BLOB))) AS stored_bytes,
              max(${textByteExpressions.join(", ")}) AS max_text_bytes,
              2 * (${textByteExpressions.join(" + ")}) AS exact_hex_payload_bytes
       FROM company_audit_events WHERE event_id = ?1`,
    )
    .bind(eventId)
    .first<{
      stored_bytes: number
      max_text_bytes: number
      exact_hex_payload_bytes: number
    }>()
  if (result === null) throw new Error("audit fixture row is missing")
  return {
    storedBytes: result.stored_bytes,
    maxTextBytes: result.max_text_bytes,
    exactHexPayloadBytes: result.exact_hex_payload_bytes,
  }
}

async function insertCorruptTextColumn(
  db: D1Database,
  column: AuditTextColumn,
  corruptExpression: string,
): Promise<void> {
  const defaults: Record<AuditTextColumn, string> = {
    event_id: "'byte-corrupt'",
    request_id: "'byte-corrupt-request'",
    action: "'legacy.corrupt'",
    target_type: "'legacy_target'",
    target_id: "'legacy-target'",
    outcome: "'succeeded'",
    reason_code: "'legacy_reason'",
    authorization_json: "'{}'",
    before_json: "'{}'",
    after_json: "'{}'",
    metadata_json: "'{}'",
    client_ip: "'198.51.100.7'",
    client_name: "'api'",
  }
  await db.exec("PRAGMA ignore_check_constraints = ON")
  await db.exec(`
    INSERT INTO audit_events
      (id, event_id, request_id, action, target_type, target_id, outcome, reason_code,
       authorization_json, before_json, after_json, metadata_json, client_ip, client_name,
       created_at)
    VALUES (-1,
      ${AUDIT_TEXT_COLUMNS.map((name) => (name === column ? corruptExpression : defaults[name])).join(", ")},
      1700000000)
  `)
}

describe("AuditEventRepository write contract", () => {
  test("prepareAppend returns the inseparable insert and changed-row guard pair", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)

    const statements = repository.prepareAppend(record())
    expect(statements).toHaveLength(2)
    await db.batch([...statements])

    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE event_id = 'event-1'")
        .first<number>("count"),
    ).toBe(1)
  })

  test("prepareAppend binds all sixteen external columns without an internal id", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)

    await db.batch([...repository.prepareAppend(record())])

    expect(
      await db
        .prepare(
          `SELECT event_id, request_id, actor_account_id, actor_employee_id, action,
                  target_type, target_id, outcome, reason_code, authorization_json,
                  before_json, after_json, metadata_json, client_ip, client_name, created_at
           FROM company_audit_events WHERE event_id = ?1`,
        )
        .bind("event-1")
        .first<Record<string, unknown>>(),
    ).toEqual({
      event_id: "event-1",
      request_id: "00000000-0000-4000-8000-000000000001",
      actor_account_id: 7,
      actor_employee_id: 11,
      action: "iam.role.updated",
      target_type: "role",
      target_id: "security-reviewer",
      outcome: "succeeded",
      reason_code: "role_updated",
      authorization_json: '{"permission":"iam:role:update"}',
      before_json: '{"name":"before"}',
      after_json: '{"name":"after"}',
      metadata_json: '{"source":"test"}',
      client_ip: "192.0.2.7",
      client_name: "cli",
      created_at: 1_700_000_000,
    })
  })

  test("append preserves UUID, code, and integer-shaped target IDs as text", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    const targetIds = ["a7648f3e-fcde-4bc8-a637-4743e3cb2e45", "E001", "42"]

    for (const [index, targetId] of targetIds.entries()) {
      await repository.append(record({ eventId: `event-${index}`, targetId }))
    }

    const result = await db
      .prepare("SELECT target_id, typeof(target_id) AS type FROM audit_events ORDER BY id")
      .all<{ target_id: string; type: string }>()
    expect(result.results).toEqual(targetIds.map((target_id) => ({ target_id, type: "text" })))
  })

  test("maps duplicate and append-guard failures to a safe 503 error", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)

    await repository.append(record())
    await expectAuditUnavailable(repository.append(record()))
  })

  test("maps an independent database trigger failure to the same safe 503 error", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await db.exec(`
      CREATE TRIGGER audit_logs_forced_failure
      BEFORE INSERT ON audit_events
      WHEN NEW.event_id = 'forced-trigger'
      BEGIN
        SELECT RAISE(ABORT, 'sensitive trigger detail');
      END;
    `)

    await expectAuditUnavailable(repository.append(record({ eventId: "forced-trigger" })))
  })

  test("maps a trigger that silently ignores the audit insert to a safe 503 error", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await db.exec(`
      CREATE TRIGGER audit_logs_silent_ignore
      BEFORE INSERT ON audit_events
      WHEN NEW.event_id = 'silently-ignored'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)

    await expectAuditUnavailable(repository.append(record({ eventId: "silently-ignored" })))
  })

  test("maps a prepare failure during append without leaking database details", async () => {
    const { context } = createTestContext()
    context.env.DB = {
      prepare() {
        throw new Error("INSERT INTO private_internal_table")
      },
    } as unknown as D1Database

    await expectAuditUnavailable(new AuditEventRepository(context).append(record()))
  })

  test("rolls back the business write when the audit insert fails", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await repository.append(record())

    expect(
      await rejectionOf(
        db.batch([
          db
            .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?2, 0, 0)")
            .bind("atomic-role", "Atomic role"),
          ...repository.prepareAppend(record()),
        ]),
      ),
    ).toBeInstanceOf(Error)

    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM roles WHERE key = 'atomic-role'")
        .first<number>("count"),
    ).toBe(0)
  })

  test("rolls back the business write when the audit insert is silently ignored", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await db.exec(`
      CREATE TRIGGER audit_logs_batch_silent_ignore
      BEFORE INSERT ON audit_events
      WHEN NEW.event_id = 'silently-ignored-in-batch'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)

    expect(
      await rejectionOf(
        db.batch([
          db
            .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?2, 0, 0)")
            .bind("ignored-audit-role", "Ignored audit role"),
          ...repository.prepareAppend(record({ eventId: "silently-ignored-in-batch" })),
        ]),
      ),
    ).toBeInstanceOf(Error)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM roles WHERE key = 'ignored-audit-role'")
        .first<number>("count"),
    ).toBe(0)
  })

  test("rolls back the audit insert when the business write fails", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)

    expect(
      await rejectionOf(
        db.batch([
          db.prepare(
            "INSERT INTO roles (key, name, is_system, created_at) VALUES ('root', 'x', 0, 0)",
          ),
          ...repository.prepareAppend(record({ eventId: "must-not-remain" })),
        ]),
      ),
    ).toBeInstanceOf(Error)

    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE event_id = 'must-not-remain'")
        .first<number>("count"),
    ).toBe(0)
  })
})

describe("AuditEventRepository search contract", () => {
  test("binds a snapshot and restores the exact mixed-width source page after next then previous", async () => {
    const { context, db } = createTestContext()
    await insertMixedWidthSameSecondRows(db, 400)
    const repository = new AuditEventRepository(context)
    const pages: Array<Awaited<ReturnType<AuditEventRepository["search"]>>> = []

    let cursor: string | null = null
    for (let index = 0; index < 5; index += 1) {
      const page = await repository.search({ limit: 100, cursor, filters: {} })
      pages.push(page)
      expect(page.items.length).toBeGreaterThan(0)
      cursor = page.nextCursor
      expect(cursor).not.toBeNull()
    }

    const source = pages[3]
    const target = pages[4]
    const restored = await repository.search({
      limit: 100,
      cursor: target?.previousCursor ?? null,
      filters: {},
    })
    expect(restored.items.map((item) => item.eventId)).toEqual(
      source?.items.map((item) => item.eventId),
    )

    await repository.append(record({ eventId: "backdated-new", createdAt: 99 }))
    const remainingIds: string[] = []
    let page = target
    let lastPage = target
    while (page !== undefined) {
      remainingIds.push(...page.items.map((item) => item.eventId))
      lastPage = page
      if (page.nextCursor === null) break
      page = await repository.search({ limit: 100, cursor: page.nextCursor, filters: {} })
    }
    expect(remainingIds).not.toContain("backdated-new")
    const allForwardIds = [
      ...pages.slice(0, 4).flatMap((item) => item.items.map((event) => event.eventId)),
      ...remainingIds,
    ]
    expect(allForwardIds).toEqual(Array.from({ length: 400 }, (_, index) => `mixed-${400 - index}`))
    expect(new Set(allForwardIds).size).toBe(400)

    let backwardPage = lastPage
    for (let index = 0; index < 3; index += 1) {
      expect(backwardPage?.previousCursor).not.toBeNull()
      const newer = await repository.search({
        limit: 100,
        cursor: backwardPage?.previousCursor ?? null,
        filters: {},
      })
      const immediateForward = await repository.search({
        limit: 100,
        cursor: newer.nextCursor,
        filters: {},
      })
      expect(immediateForward.items.map((item) => item.eventId)).toEqual(
        backwardPage?.items.map((item) => item.eventId),
      )
      backwardPage = newer
    }

    expect(
      await rejectionOf(
        repository.search({ limit: 99, cursor: target?.previousCursor ?? null, filters: {} }),
      ),
    ).toBeInstanceOf(ValidationError)
    expect(
      await rejectionOf(
        repository.search({
          limit: 100,
          cursor: target?.previousCursor ?? null,
          filters: { action: "legacy.mixed" },
        }),
      ),
    ).toBeInstanceOf(ValidationError)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test("returns an empty stable page", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)

    expect(await repository.search({ limit: 50, cursor: null, filters: {} })).toEqual({
      items: [],
      nextCursor: null,
      previousCursor: null,
    })
  })

  test("orders same-second rows by descending internal id without exposing that id", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)
    for (let id = 1; id <= 3; id += 1) {
      await repository.append(record({ eventId: `event-${id}`, createdAt: 100 }))
    }

    const page = await repository.search({ limit: 2, cursor: null, filters: {} })

    expect(page.items.map((item) => item.eventId)).toEqual(["event-3", "event-2"])
    expect(page.nextCursor).not.toBeNull()
    expect(page.previousCursor).toBeNull()
    expect(Object.keys(page.items[0] ?? {})).not.toContain("id")
    expect(Object.keys(page.items[0] ?? {})).not.toContain("metadataJson")
    expect(Object.keys(page.items[0] ?? {})).not.toContain("clientIp")

    const next = await repository.search({ limit: 2, cursor: page.nextCursor, filters: {} })
    const previous = await repository.search({
      limit: 2,
      cursor: next.previousCursor,
      filters: {},
    })
    expect(next.items.map((item) => item.eventId)).toEqual(["event-1"])
    expect(previous.items.map((item) => item.eventId)).toEqual(["event-3", "event-2"])
  })

  test("does not select detail-only columns for a summary search", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)
    await repository.append(record())

    const source = context.env.DB
    const preparedSql: string[] = []
    context.env.DB = new Proxy(source, {
      get(target, property) {
        if (property === "prepare") {
          return (sql: string) => {
            preparedSql.push(sql)
            return target.prepare(sql)
          }
        }

        const value = Reflect.get(target, property, target) as unknown
        return typeof value === "function" ? value.bind(target) : value
      },
    })

    await repository.search({ limit: 50, cursor: null, filters: {} })

    expect(preparedSql).toHaveLength(2)
    for (const sql of preparedSql) {
      expect(sql).not.toContain("authorization_json")
      expect(sql).not.toContain("before_json")
      expect(sql).not.toContain("after_json")
      expect(sql).not.toContain("metadata_json")
      expect(sql).not.toContain("client_ip")
    }
    expect(preparedSql.some((sql) => sql.includes("wire_bytes"))).toBe(true)
    expect(preparedSql.some((sql) => sql.includes("json_each"))).toBe(true)
  })

  test("bounds wide summary reads and traverses every shortened same-second page once", async () => {
    const { context, db } = createTestContext()
    await insertWideSummaryRows(db, 101, 200_000)
    const reads = observeAllReads(context)
    const repository = new AuditEventRepository(context)

    const first = await repository.search({ limit: 100, cursor: null, filters: {} })
    expect(reads[0]?.payloadBytes).toBeLessThan(16 * 1024 * 1024)
    expect(first.items.length).toBeGreaterThan(0)
    expect(first.items.length).toBeLessThan(100)
    expect(first.nextCursor).not.toBeNull()

    const second = await repository.search({ limit: 100, cursor: first.nextCursor, filters: {} })
    expect(second.previousCursor).not.toBeNull()
    const backToFirst = await repository.search({
      limit: 100,
      cursor: second.previousCursor,
      filters: {},
    })
    expect(backToFirst.items.map((item) => item.eventId)).toEqual(
      first.items.map((item) => item.eventId),
    )

    const eventIds = first.items.map((item) => item.eventId)
    let page = second
    while (true) {
      eventIds.push(...page.items.map((item) => item.eventId))
      if (page.nextCursor === null) break
      page = await repository.search({ limit: 100, cursor: page.nextCursor, filters: {} })
    }

    expect(eventIds).toEqual(Array.from({ length: 101 }, (_, index) => `wide-${101 - index}`))
    expect(new Set(eventIds).size).toBe(101)
    const descriptorReads = reads.filter((read) => read.sql.includes("wire_bytes"))
    const exactReads = reads.filter((read) => read.sql.includes("json_each"))
    expect(Math.max(...reads.map((read) => read.payloadBytes))).toBeLessThan(16 * 1024 * 1024)
    expect(Math.max(...descriptorReads.map((read) => read.payloadBytes))).toBeLessThan(64 * 1024)
    expect(Math.max(...exactReads.map((read) => read.payloadBytes))).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(descriptorReads.length).toBeGreaterThan(1)
    expect(exactReads.length).toBeGreaterThan(1)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test("segments a remote-valid summary whose combined exact HEX row exceeds the D1 row limit", async () => {
    const { context, db } = createTestContext()
    const targetId = "x".repeat(600_000)
    const reasonCode = "y".repeat(600_000)
    await insertLegacyRow(db, { eventId: "combined-summary", targetId, reasonCode })
    const metrics = await readStoredAuditRowMetrics(db, "combined-summary")
    expect(metrics.storedBytes).toBeLessThan(2_000_000)
    expect(metrics.maxTextBytes).toBeLessThanOrEqual(999_000)
    expect(metrics.exactHexPayloadBytes).toBeGreaterThanOrEqual(2_000_000)
    const reads = enforceD1ReadResultLimits(context)

    const page = await new AuditEventRepository(context).search({
      limit: 50,
      cursor: null,
      filters: {},
    })

    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.targetId).toBe(targetId)
    expect(page.items[0]?.reasonCode).toBe(reasonCode)
    expect(new TextEncoder().encode(JSON.stringify(page)).byteLength).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(reads.length).toBeLessThanOrEqual(25)
    expect(reads.some((read) => read.sql.includes("hex(substr"))).toBe(true)
    expect(reads.every((read) => read.maxRowPayloadBytes < 2_000_000)).toBe(true)
    expect(reads.every((read) => read.payloadBytes <= 4 * 1024 * 1024)).toBe(true)
  })

  test("keeps a near-limit summary exact and segments the first unsafe combined HEX row", async () => {
    const { context, db } = createTestContext()
    const exactTargetId = "x".repeat(499_700)
    const exactReasonCode = "y".repeat(499_700)
    const segmentedTargetId = "x".repeat(500_000)
    const segmentedReasonCode = "y".repeat(500_000)
    await insertLegacyRow(db, {
      id: 1,
      eventId: "near-summary-exact",
      targetId: exactTargetId,
      reasonCode: exactReasonCode,
      createdAt: 2,
    })
    await insertLegacyRow(db, {
      id: 2,
      eventId: "near-summary-segmented",
      targetId: segmentedTargetId,
      reasonCode: segmentedReasonCode,
      createdAt: 1,
    })
    const exactMetrics = await readStoredAuditRowMetrics(db, "near-summary-exact")
    const segmentedMetrics = await readStoredAuditRowMetrics(db, "near-summary-segmented")
    expect(exactMetrics.exactHexPayloadBytes).toBeLessThan(2_000_000)
    expect(segmentedMetrics.storedBytes).toBeLessThan(2_000_000)
    expect(segmentedMetrics.maxTextBytes).toBeLessThanOrEqual(999_000)
    expect(segmentedMetrics.exactHexPayloadBytes).toBeGreaterThanOrEqual(2_000_000)
    const reads = enforceD1ReadResultLimits(context)

    const page = await new AuditEventRepository(context).search({
      limit: 50,
      cursor: null,
      filters: {},
    })

    expect(page.items.map((item) => item.eventId)).toEqual([
      "near-summary-exact",
      "near-summary-segmented",
    ])
    expect(page.items[0]?.targetId).toBe(exactTargetId)
    expect(page.items[1]?.targetId).toBe(segmentedTargetId)
    expect(new TextEncoder().encode(JSON.stringify(page)).byteLength).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(
      reads.filter((read) => read.sql.includes("WHERE id IN (SELECT value FROM json_each(?1))")),
    ).toHaveLength(1)
    expect(reads.some((read) => read.sql.includes("hex(substr"))).toBe(true)
    expect(reads.every((read) => read.maxRowPayloadBytes < 2_000_000)).toBe(true)
    expect(reads.every((read) => read.payloadBytes <= 4 * 1024 * 1024)).toBe(true)
    expect(reads.length).toBeLessThanOrEqual(25)
  })

  test("fails closed from a narrow descriptor without fetching one oversized summary row", async () => {
    const { context, db } = createTestContext()
    await insertLegacyRow(db, {
      eventId: "oversized-summary",
      targetId: "x".repeat(4 * 1024 * 1024),
    })
    const reads = observeAllReads(context)

    await expectAuditUnavailable(
      new AuditEventRepository(context).search({ limit: 100, cursor: null, filters: {} }),
    )

    expect(reads).toHaveLength(1)
    expect(reads[0]?.rowCount).toBe(1)
    expect(reads[0]?.payloadBytes).toBeLessThan(1_024)
    expect(reads[0]?.sql).toContain("wire_bytes")
    expect(reads[0]?.sql).not.toContain("json_each")
  })

  test("navigates first, next, previous, and last pages without an off-by-one", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)
    for (let id = 1; id <= 5; id += 1) {
      await repository.append(record({ eventId: `event-${id}`, createdAt: 100 + id }))
    }

    const first = await repository.search({ limit: 2, cursor: null, filters: {} })
    const second = await repository.search({ limit: 2, cursor: first.nextCursor, filters: {} })
    const last = await repository.search({ limit: 2, cursor: second.nextCursor, filters: {} })
    const backToSecond = await repository.search({
      limit: 2,
      cursor: last.previousCursor,
      filters: {},
    })
    const backToFirst = await repository.search({
      limit: 2,
      cursor: backToSecond.previousCursor,
      filters: {},
    })

    expect(first.items.map((item) => item.eventId)).toEqual(["event-5", "event-4"])
    expect(second.items.map((item) => item.eventId)).toEqual(["event-3", "event-2"])
    expect(last.items.map((item) => item.eventId)).toEqual(["event-1"])
    expect(last.nextCursor).toBeNull()
    expect(backToSecond.items.map((item) => item.eventId)).toEqual(["event-3", "event-2"])
    expect(backToFirst.items.map((item) => item.eventId)).toEqual(["event-5", "event-4"])
    expect(backToFirst.previousCursor).toBeNull()
  })

  test("uses a negative legacy id in a cursor", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await insertLegacyRow(db, { id: -7, eventId: "legacy--7", createdAt: 100 })
    await insertLegacyRow(db, { id: -8, eventId: "legacy--8", createdAt: 100 })

    const page = await repository.search({ limit: 1, cursor: null, filters: {} })

    expect(page.items[0]?.eventId).toBe("legacy--7")
    expect(AuditCursor.decode(page.nextCursor ?? "").sourceLast[1]).toBe(-7)
  })

  test("does not advertise a next page when exactly limit rows exist", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)
    await repository.append(record({ eventId: "event-1", createdAt: 1 }))
    await repository.append(record({ eventId: "event-2", createdAt: 2 }))

    const page = await repository.search({ limit: 2, cursor: null, filters: {} })

    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).toBeNull()
  })

  test("does not duplicate rows when a newer row is appended between pages", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)
    for (let id = 1; id <= 4; id += 1) {
      await repository.append(record({ eventId: `event-${id}`, createdAt: id }))
    }
    const first = await repository.search({ limit: 2, cursor: null, filters: {} })
    await repository.append(record({ eventId: "event-5", createdAt: 5 }))
    const second = await repository.search({ limit: 2, cursor: first.nextCursor, filters: {} })

    expect(first.items.map((item) => item.eventId)).toEqual(["event-4", "event-3"])
    expect(second.items.map((item) => item.eventId)).toEqual(["event-2", "event-1"])
  })

  test("keeps ValidationError from an invalid cursor instead of wrapping it as 503", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)

    expect(
      await rejectionOf(repository.search({ limit: 50, cursor: "not+base64url", filters: {} })),
    ).toBeInstanceOf(ValidationError)
  })

  test("binds every filter exactly and composes filters", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await repository.append(
      record({
        eventId: "alpha",
        actorAccountId: 7,
        action: "iam.role.updated",
        targetType: "role",
        targetId: "alpha",
        outcome: "succeeded",
        createdAt: 100,
      }),
    )
    await repository.append(
      record({
        eventId: "beta",
        actorAccountId: 8,
        action: "iam.role.created",
        targetType: "role",
        targetId: "beta",
        outcome: "denied",
        createdAt: 200,
      }),
    )
    const quotedAction = "legacy' OR 1=1 --"
    await insertLegacyRow(db, {
      id: 50,
      eventId: "quoted",
      actorAccountId: 9,
      action: quotedAction,
      targetType: "legacy_target",
      targetId: "quoted-target",
      createdAt: 300,
    })

    const cases = [
      [{ actorAccountId: 7 }, ["alpha"]],
      [{ action: "iam.role.created" }, ["beta"]],
      [{ action: quotedAction }, ["quoted"]],
      [{ targetType: "legacy_target" }, ["quoted"]],
      [{ targetId: "beta" }, ["beta"]],
      [{ outcome: "denied" as const }, ["beta"]],
      [{ fromEpoch: 200 }, ["quoted", "beta"]],
      [{ toEpoch: 200 }, ["alpha"]],
      [{ fromEpoch: 100, toEpoch: 200 }, ["alpha"]],
      [
        {
          actorAccountId: 7,
          action: "iam.role.updated",
          targetType: "role",
          targetId: "alpha",
          outcome: "succeeded" as const,
          fromEpoch: 100,
          toEpoch: 101,
        },
        ["alpha"],
      ],
    ] as const

    for (const [filters, expected] of cases) {
      const page = await repository.search({ limit: 100, cursor: null, filters })
      expect(page.items.map((item) => item.eventId)).toEqual([...expected])
    }
  })

  test("accepts a signed safe legacy actor filter and returns the matching row", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await insertLegacyRow(db, {
      id: -77,
      eventId: "legacy-negative-actor",
      actorAccountId: -7,
    })

    const page = await repository.search({
      limit: 50,
      cursor: null,
      filters: { actorAccountId: -7 },
    })

    expect(page.items.map((item) => item.eventId)).toEqual(["legacy-negative-actor"])
    expect(page.items[0]?.actorAccountId).toBe(-7)
  })

  test("maps database failures to a safe 503 for every read path", async () => {
    const { context } = createTestContext()
    context.env.DB = {
      prepare() {
        throw new Error("SELECT secret_internal_table")
      },
    } as unknown as D1Database
    const repository = new AuditEventRepository(context)

    await expectAuditUnavailable(repository.search({ limit: 50, cursor: null, filters: {} }))
    await expectAuditUnavailable(repository.findByEventId("event-1"))
    await expectAuditUnavailable(repository.export({ filters: {} }))
  })
})

describe("AuditEventRepository detail and corruption contract", () => {
  test.each([...AUDIT_TEXT_COLUMNS])(
    "rejects invalid UTF-8 bytes in stored %s without replacement decoding",
    async (column) => {
      const { context, db } = createTestContext()
      await insertCorruptTextColumn(db, column, "CAST(X'80' AS TEXT)")
      const repository = new AuditEventRepository(context)

      if (AUDIT_SUMMARY_TEXT_COLUMNS.has(column)) {
        await expectAuditUnavailable(repository.search({ limit: 50, cursor: null, filters: {} }))
      } else {
        expect(
          (await repository.search({ limit: 50, cursor: null, filters: {} })).items,
        ).toHaveLength(1)
      }
      if (column !== "event_id") {
        await expectAuditUnavailable(repository.findByEventId("byte-corrupt"))
      }
      await expectAuditUnavailable(repository.export({ filters: {} }))
    },
  )

  test.each([...AUDIT_TEXT_COLUMNS])(
    "rejects non-text BLOB storage in %s even when its bytes spell valid text",
    async (column) => {
      const { context, db } = createTestContext()
      await insertCorruptTextColumn(db, column, "CAST('replacement' AS BLOB)")
      const repository = new AuditEventRepository(context)

      if (AUDIT_SUMMARY_TEXT_COLUMNS.has(column)) {
        await expectAuditUnavailable(repository.search({ limit: 50, cursor: null, filters: {} }))
      } else {
        expect(
          (await repository.search({ limit: 50, cursor: null, filters: {} })).items,
        ).toHaveLength(1)
      }
      if (column !== "event_id") {
        await expectAuditUnavailable(repository.findByEventId("byte-corrupt"))
      }
      await expectAuditUnavailable(repository.export({ filters: {} }))
    },
  )

  test("rejects invalid UTF-8 and non-text storage without replacement on every read family", async () => {
    for (const corruptionSql of ["CAST(X'80' AS TEXT)", "CAST(X'EFBFBD' AS BLOB)"]) {
      const { context, db } = createTestContext()
      await db.exec(`
        INSERT INTO audit_events
          (id, event_id, request_id, action, target_type, target_id,
           outcome, client_name, created_at)
        VALUES (-1, 'byte-corrupt', 'byte-corrupt-request', 'legacy.corrupt',
                'legacy_target', ${corruptionSql}, 'succeeded', 'api', 1700000000)
      `)
      const repository = new AuditEventRepository(context)

      await expectAuditUnavailable(repository.search({ limit: 50, cursor: null, filters: {} }))
      await expectAuditUnavailable(repository.findByEventId("byte-corrupt"))
      await expectAuditUnavailable(repository.export({ filters: {} }))
    }
  })

  test.each([
    ["search", "changed-actor"],
    ["search", "changed-length"],
    ["detail", "changed-actor"],
    ["detail", "changed-length"],
  ] as const)("rejects an exact %s response with %s", async (read, mode) => {
    const { context, db } = createTestContext()
    await insertLegacyRow(db, { eventId: "exact-layout" })
    tamperExactRead(context, mode)
    const repository = new AuditEventRepository(context)

    await expectAuditUnavailable(
      read === "search"
        ? repository.search({ limit: 50, cursor: null, filters: {} })
        : repository.findByEventId("exact-layout"),
    )
  })

  test("segments a remote-valid detail whose combined exact HEX row exceeds the D1 row limit", async () => {
    const { context, db } = createTestContext()
    const authorizationJson = JSON.stringify("x".repeat(600_000))
    const metadataJson = JSON.stringify("y".repeat(600_000))
    await insertLegacyRow(db, {
      eventId: "combined-detail",
      authorizationJson,
      metadataJson,
    })
    const metrics = await readStoredAuditRowMetrics(db, "combined-detail")
    expect(metrics.storedBytes).toBeLessThan(2_000_000)
    expect(metrics.maxTextBytes).toBeLessThanOrEqual(999_000)
    expect(metrics.exactHexPayloadBytes).toBeGreaterThanOrEqual(2_000_000)
    const reads = enforceD1ReadResultLimits(context)

    const detail = await new AuditEventRepository(context).findByEventId("combined-detail")

    expect(detail?.authorizationJson).toBe(authorizationJson)
    expect(detail?.metadataJson).toBe(metadataJson)
    expect(new TextEncoder().encode(JSON.stringify(detail)).byteLength).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(reads.length).toBeLessThanOrEqual(25)
    expect(reads.some((read) => read.sql.includes("hex(substr"))).toBe(true)
    expect(reads.every((read) => read.maxRowPayloadBytes < 2_000_000)).toBe(true)
    expect(reads.every((read) => read.payloadBytes <= 4 * 1024 * 1024)).toBe(true)
  })

  test("keeps a near-limit detail exact and segments the first unsafe combined HEX row", async () => {
    const { context, db } = createTestContext()
    const exactAuthorizationJson = JSON.stringify("x".repeat(499_300))
    const exactMetadataJson = JSON.stringify("y".repeat(499_300))
    const segmentedAuthorizationJson = JSON.stringify("x".repeat(500_000))
    const segmentedMetadataJson = JSON.stringify("y".repeat(500_000))
    await insertLegacyRow(db, {
      id: 1,
      eventId: "near-detail-exact",
      authorizationJson: exactAuthorizationJson,
      metadataJson: exactMetadataJson,
      createdAt: 2,
    })
    await insertLegacyRow(db, {
      id: 2,
      eventId: "near-detail-segmented",
      authorizationJson: segmentedAuthorizationJson,
      metadataJson: segmentedMetadataJson,
      createdAt: 1,
    })
    const exactMetrics = await readStoredAuditRowMetrics(db, "near-detail-exact")
    const segmentedMetrics = await readStoredAuditRowMetrics(db, "near-detail-segmented")
    expect(exactMetrics.exactHexPayloadBytes).toBeLessThan(2_000_000)
    expect(segmentedMetrics.storedBytes).toBeLessThan(2_000_000)
    expect(segmentedMetrics.maxTextBytes).toBeLessThanOrEqual(999_000)
    expect(segmentedMetrics.exactHexPayloadBytes).toBeGreaterThanOrEqual(2_000_000)
    const reads = enforceD1ReadResultLimits(context)
    const repository = new AuditEventRepository(context)

    const exact = await repository.findByEventId("near-detail-exact")
    const segmented = await repository.findByEventId("near-detail-segmented")

    expect(exact?.metadataJson).toBe(exactMetadataJson)
    expect(segmented?.metadataJson).toBe(segmentedMetadataJson)
    expect(new TextEncoder().encode(JSON.stringify(exact)).byteLength).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(new TextEncoder().encode(JSON.stringify(segmented)).byteLength).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(
      reads.filter((read) => read.sql.includes("WHERE id IN (SELECT value FROM json_each(?1))")),
    ).toHaveLength(1)
    expect(reads.some((read) => read.sql.includes("hex(substr"))).toBe(true)
    expect(reads.every((read) => read.maxRowPayloadBytes < 2_000_000)).toBe(true)
    expect(reads.every((read) => read.payloadBytes <= 4 * 1024 * 1024)).toBe(true)
    expect(reads.length).toBeLessThanOrEqual(25)
  })

  test("returns legacy unknown vocabulary, nullable target, JSON text, and IP unchanged", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await insertLegacyRow(db, {
      id: -1,
      eventId: "legacy--1",
      action: "legacy.unknown.action",
      targetType: null,
      targetId: null,
      reasonCode: "legacy_unknown_reason",
      metadataJson: '{"verbatim":"値🔐"}',
      clientIp: "203.0.113.9",
    })

    expect(await repository.findByEventId("legacy--1")).toEqual({
      eventId: "legacy--1",
      requestId: "legacy-request--1",
      actorAccountId: 7,
      actorEmployeeId: 11,
      action: "legacy.unknown.action",
      targetType: null,
      targetId: null,
      outcome: "succeeded",
      reasonCode: "legacy_unknown_reason",
      authorizationJson: '{"scope":"legacy"}',
      beforeJson: '{"state":"before"}',
      afterJson: '{"state":"after"}',
      metadataJson: '{"verbatim":"値🔐"}',
      clientIp: "203.0.113.9",
      clientName: "api",
      createdAt: 1_700_000_000,
    })
    expect(await repository.findByEventId("missing")).toBeNull()
  })

  test("preserves remote-valid BOM, Unicode, and JSON bytes in summary, detail, and export", async () => {
    const { context, db } = createTestContext()
    const metadataJson = JSON.stringify({ note: "\uFEFF値🔐", lines: "a\r\nb" })
    await db
      .prepare(
        `INSERT INTO audit_events
           (id, event_id, request_id, action, target_type, target_id, outcome,
            authorization_json, metadata_json, client_name, created_at)
         VALUES (-1, 'remote-byte-faithful', 'remote-byte-request', 'legacy.unicode',
                 'legacy_target', CAST(X'EFBBBF' AS TEXT) || '対象🔐', 'succeeded',
                 '{"permission":"audit:read"}', ?1, 'api', 1700000000)`,
      )
      .bind(metadataJson)
      .run()
    const repository = new AuditEventRepository(context)

    const summary = (await repository.search({ limit: 50, cursor: null, filters: {} })).items[0]
    const detail = await repository.findByEventId("remote-byte-faithful")
    const exported = (await repository.export({ filters: {} }))[0]

    expect(summary?.targetId).toBe("\uFEFF対象🔐")
    expect(detail?.targetId).toBe("\uFEFF対象🔐")
    expect(detail?.metadataJson).toBe(metadataJson)
    expect(exported?.targetId).toBe("\uFEFF対象🔐")
    expect(exported?.metadataJson).toBe(metadataJson)
  })

  test("local-only >2 MB stress preserves leading BOM fields through segmented reads", async () => {
    const { context, db } = createTestContext()
    const bom = "\uFEFF"
    const eventId = "e".repeat(4 * 1024 * 1024)
    const requestId = `${bom}legacy-request`
    const action = `${bom}legacy.action`
    const targetType = `${bom}legacy_target`
    const targetId = `${bom}legacy-target`
    const reasonCode = `${bom}legacy_reason`
    const authorizationJson = JSON.stringify(`${bom}authorization`)
    const beforeJson = JSON.stringify(`${bom}before`)
    const afterJson = JSON.stringify(`${bom}after`)
    const metadataJson = JSON.stringify(`${bom}metadata`)
    const clientIp = `${bom}198.51.100.7`
    const bomText = "CAST(X'EFBBBF' AS TEXT)"
    await db
      .prepare(
        `INSERT INTO audit_events
           (id, event_id, request_id, actor_account_id, action,
            target_type, target_id, outcome, reason_code, authorization_json,
            before_json, after_json, metadata_json, client_ip, client_name, created_at)
         VALUES (-1, ?1, ${bomText} || 'legacy-request', 7,
                 ${bomText} || 'legacy.action', ${bomText} || 'legacy_target',
                 ${bomText} || 'legacy-target', 'succeeded',
                 ${bomText} || 'legacy_reason', ?2, ?3, ?4, ?5,
                 ${bomText} || '198.51.100.7', 'api', 1700000000)`,
      )
      .bind("e".repeat(4 * 1024 * 1024), authorizationJson, beforeJson, afterJson, metadataJson)
      .run()
    await db
      .prepare(
        "INSERT INTO audit_event_employee_contexts (audit_event_id, employee_id) VALUES (-1, 11)",
      )
      .run()
    const expected: AuditEventDetail = {
      eventId,
      requestId,
      actorAccountId: 7,
      actorEmployeeId: 11,
      action,
      targetType,
      targetId,
      outcome: "succeeded",
      reasonCode,
      authorizationJson,
      beforeJson,
      afterJson,
      metadataJson,
      clientIp,
      clientName: "api",
      createdAt: 1_700_000_000,
    }
    const repository = new AuditEventRepository(context)

    expect(await repository.findByEventId(eventId)).toEqual(expected)
    expect(await repository.export({ filters: {} })).toEqual([expected])
  })

  test("local-only >2 MB stress rejects BOM-prefixed malformed metadata after segmentation", async () => {
    const { context, db } = createTestContext()
    await db
      .prepare(
        `INSERT INTO audit_events
           (id, event_id, request_id, actor_account_id, action,
            target_type, target_id, outcome, reason_code, authorization_json,
            before_json, after_json, metadata_json, client_ip, client_name, created_at)
         VALUES (-1, 'bom-invalid-json', 'legacy-request--1', 7,
                 'legacy.unknown.action', 'legacy_target', 'legacy--1', 'succeeded',
                 'legacy_reason', '{"scope":"legacy"}', '{"state":"before"}',
                 '{"state":"after"}', CAST(X'EFBBBF' AS TEXT) || ?1,
                 '198.51.100.7', 'api', 1700000000)`,
      )
      .bind(JSON.stringify("x".repeat(4 * 1024 * 1024)))
      .run()
    await db
      .prepare(
        "INSERT INTO audit_event_employee_contexts (audit_event_id, employee_id) VALUES (-1, 11)",
      )
      .run()
    const repository = new AuditEventRepository(context)

    await expectAuditUnavailable(repository.findByEventId("bom-invalid-json"))
    await expectAuditUnavailable(repository.export({ filters: {} }))
  })

  test.each([
    ["authorization_json", { authorizationJson: "{" }],
    ["before_json", { beforeJson: "{" }],
    ["after_json", { afterJson: "{" }],
    ["metadata_json", { metadataJson: "{" }],
  ] as const)(
    "maps malformed %s to safe 503 errors for detail and export",
    async (_, overrides) => {
      const { context, db } = createTestContext()
      const repository = new AuditEventRepository(context)
      await insertLegacyRow(db, { eventId: "malformed-json", ...overrides })

      expect(
        (await repository.search({ limit: 50, cursor: null, filters: {} })).items.map(
          (item) => item.eventId,
        ),
      ).toEqual(["malformed-json"])

      const reads = await Promise.allSettled([
        repository.findByEventId("malformed-json"),
        repository.export({ filters: {} }),
      ])
      expect(reads.map((result) => result.status)).toEqual(["rejected", "rejected"])
      for (const result of reads) {
        if (result.status !== "rejected") continue
        expect(result.reason).toBeInstanceOf(UnavailableError)
        expect((result.reason as UnavailableError).code).toBe("audit_unavailable")
      }
    },
  )

  test("accepts JSON scalars and a legacy JSON-string wrapper without reserializing them", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    const legacyWrapper = JSON.stringify('{"legacy":true}')
    await insertLegacyRow(db, {
      eventId: "legacy-json-shapes",
      authorizationJson: "true",
      beforeJson: "42",
      afterJson: "null",
      metadataJson: legacyWrapper,
    })

    const detail = await repository.findByEventId("legacy-json-shapes")
    expect(detail?.authorizationJson).toBe("true")
    expect(detail?.beforeJson).toBe("42")
    expect(detail?.afterJson).toBe("null")
    expect(detail?.metadataJson).toBe(legacyWrapper)
    expect((await repository.export({ filters: {} }))[0]?.metadataJson).toBe(legacyWrapper)
  })

  test("maps corrupted rows to safe 503 errors for search, detail, and export", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await insertLegacyRow(db, { eventId: "corrupt", actorAccountId: "not-an-integer" })

    await expectAuditUnavailable(repository.search({ limit: 50, cursor: null, filters: {} }))
    await expectAuditUnavailable(repository.findByEventId("corrupt"))
    await expectAuditUnavailable(repository.export({ filters: {} }))
  })

  test("rejects a safe-integer epoch outside the JavaScript ISO date range as corruption", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await insertLegacyRow(db, {
      eventId: "invalid-date",
      createdAt: Number.MAX_SAFE_INTEGER,
    })

    await expectAuditUnavailable(repository.search({ limit: 50, cursor: null, filters: {} }))
    await expectAuditUnavailable(repository.findByEventId("invalid-date"))
    await expectAuditUnavailable(repository.export({ filters: {} }))
  })

  test("returns an empty export without failure", async () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)

    expect(await repository.export({ filters: {} })).toEqual([])
  })

  test("local-only >2 MB stress accepts exactly sixteen MiB and rejects one-byte overflow", async () => {
    const boundaryDetail: AuditEventDetail = {
      eventId: "legacy--1",
      requestId: "legacy-request--1",
      actorAccountId: 7,
      actorEmployeeId: 11,
      action: "legacy.unknown.action",
      targetType: "legacy_target",
      targetId: "legacy--1",
      outcome: "succeeded",
      reasonCode: "legacy_reason",
      authorizationJson: '{"scope":"legacy"}',
      beforeJson: '{"state":"before"}',
      afterJson: '{"state":"after"}',
      metadataJson: '""',
      clientIp: "198.51.100.7",
      clientName: "api",
      createdAt: 1_700_000_000,
    }
    const baseBytes = new TextEncoder().encode(toAuditCsv([boundaryDetail])).byteLength
    const exactMetadataLength = AUDIT_CSV_MAX_BYTES - baseBytes

    const exact = createTestContext()
    await insertLegacyRow(exact.db, {
      metadataJson: JSON.stringify("x".repeat(exactMetadataLength)),
    })
    const exactRows = await new AuditEventRepository(exact.context).export({ filters: {} })
    expect(new TextEncoder().encode(toAuditCsv(exactRows)).byteLength).toBe(AUDIT_CSV_MAX_BYTES)

    const overflow = createTestContext()
    await insertLegacyRow(overflow.db, {
      metadataJson: JSON.stringify("x".repeat(exactMetadataLength + 1)),
    })
    expect(
      await rejectionOf(new AuditEventRepository(overflow.context).export({ filters: {} })),
    ).toBeInstanceOf(PayloadTooLargeError)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test("remote-compatible multi-row export accepts exactly sixteen MiB and rejects one byte more", async () => {
    const rowCount = 9
    const emptyRows: AuditEventDetail[] = Array.from({ length: rowCount }, (_, index) => {
      const id = index + 1
      return {
        eventId: `l${id}`,
        requestId: "r",
        actorAccountId: null,
        actorEmployeeId: null,
        action: "a",
        targetType: null,
        targetId: null,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: null,
        afterJson: null,
        metadataJson: JSON.stringify(""),
        clientIp: null,
        clientName: "api",
        createdAt: id,
      }
    })
    const baseBytes = new TextEncoder().encode(toAuditCsv(emptyRows)).byteLength
    const contentBytes = AUDIT_CSV_MAX_BYTES - baseBytes
    const contentLengths = Array.from(
      { length: rowCount },
      (_, index) => Math.floor(contentBytes / rowCount) + (index < contentBytes % rowCount ? 1 : 0),
    )
    const metadataValues = contentLengths.map((length) => JSON.stringify("x".repeat(length)))
    expect(
      Math.max(...metadataValues.map((value) => new TextEncoder().encode(value).byteLength)),
    ).toBeLessThan(2_000_000)

    const exact = createTestContext()
    for (const [index, metadataJson] of metadataValues.entries()) {
      await insertMinimalRemoteMetadataRows(exact.db, {
        firstId: index + 1,
        count: 1,
        metadataJson,
      })
    }
    Bun.gc(true)
    const exactMemoryBefore = process.memoryUsage()
    const exactRows = await new AuditEventRepository(exact.context).export({ filters: {} })
    Bun.gc(true)
    const exactMemoryAfter = process.memoryUsage()
    expect(
      exactMemoryAfter.heapUsed +
        exactMemoryAfter.arrayBuffers -
        (exactMemoryBefore.heapUsed + exactMemoryBefore.arrayBuffers),
    ).toBeLessThan(64 * 1024 * 1024)
    expect(new TextEncoder().encode(toAuditCsv(exactRows)).byteLength).toBe(AUDIT_CSV_MAX_BYTES)

    const overflow = createTestContext()
    for (const [index, metadataJson] of metadataValues.entries()) {
      await insertMinimalRemoteMetadataRows(overflow.db, {
        firstId: index + 1,
        count: 1,
        metadataJson:
          index === metadataValues.length - 1
            ? JSON.stringify("x".repeat((contentLengths[index] as number) + 1))
            : metadataJson,
      })
    }
    expect(
      await rejectionOf(new AuditEventRepository(overflow.context).export({ filters: {} })),
    ).toBeInstanceOf(PayloadTooLargeError)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test("local-only >2 MB stress bounds segmented quote-heavy JSON that still fits CSV", async () => {
    const { context, db } = createTestContext()
    const metadataJson = JSON.stringify('"'.repeat(5_500_000))
    await insertLegacyRow(db, { eventId: "quote-heavy", metadataJson })
    const reads = observeAllReads(context)
    const repository = new AuditEventRepository(context)

    const detail = await repository.findByEventId("quote-heavy")
    expect(detail?.metadataJson).toBe(metadataJson)
    expect(Math.max(...reads.map((read) => read.payloadBytes))).toBeLessThan(AUDIT_CSV_MAX_BYTES)
    expect(reads.some((read) => read.sql.includes("hex(substr"))).toBe(true)
    reads.length = 0

    const rows = await repository.export({ filters: {} })
    const csvBytes = new TextEncoder().encode(toAuditCsv(rows)).byteLength
    const segmentReads = reads.filter((read) => read.sql.includes("hex(substr"))

    expect(rows[0]?.metadataJson).toBe(metadataJson)
    expect(csvBytes).toBeGreaterThan(16_500_000)
    expect(csvBytes).toBeLessThanOrEqual(AUDIT_CSV_MAX_BYTES)
    expect(Math.max(...reads.map((read) => read.payloadBytes))).toBeLessThan(AUDIT_CSV_MAX_BYTES)
    expect(segmentReads).toHaveLength(6)
    expect(Math.max(...segmentReads.map((read) => read.payloadBytes))).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(Math.max(...segmentReads.map((read) => read.maxRowPayloadBytes))).toBeLessThan(2_000_000)
    expect(segmentReads.every((read) => read.sql.includes("FROM json_each(?1)"))).toBe(true)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test.each([
    "failure",
    "missing",
    "duplicate",
    "reordered",
    "changed-id",
    "changed-created-at",
    "changed-actor",
    "changed-storage",
    "changed-length",
    "invalid-hex",
    "invalid-utf8",
  ] as const)("local-only >2 MB stress maps a segmented %s response to safe 503", async (mode) => {
    const { context, db } = createTestContext()
    await insertLegacyRow(db, {
      eventId: `segment-${mode}`,
      metadataJson: JSON.stringify('"'.repeat(1_100_000)),
    })
    tamperSegmentRead(context, mode)

    await expectAuditUnavailable(new AuditEventRepository(context).export({ filters: {} }))
  })

  test("rejects a same-length invalid UTF-8 mutation in a remote-valid segmented value", async () => {
    const { context, db } = createTestContext()
    await insertMinimalRemoteMetadataRows(db, {
      firstId: 1,
      count: 1,
      metadataJson: JSON.stringify("x".repeat(1_000_000)),
    })
    tamperSegmentRead(context, "invalid-utf8")

    await expectAuditUnavailable(new AuditEventRepository(context).export({ filters: {} }))
  })

  test("returns normal byte-faithful payloads in the bounded descriptor query", async () => {
    const { context, db } = createTestContext()
    const metadataJson = JSON.stringify('"'.repeat(400_000))
    await insertLegacyRow(db, { id: 1, eventId: "wire-1", metadataJson, createdAt: 2 })
    await insertLegacyRow(db, { id: 2, eventId: "wire-2", metadataJson, createdAt: 1 })
    const reads = observeAllReads(context)

    const rows = await new AuditEventRepository(context).export({ filters: {} })
    const descriptorReads = reads.filter((read) => read.sql.includes("cumulative_wire_bytes"))

    expect(rows.map((row) => row.eventId)).toEqual(["wire-1", "wire-2"])
    expect(descriptorReads).toHaveLength(2)
    expect(descriptorReads[0]?.rowCount).toBe(2)
    expect(reads).toEqual(descriptorReads)
    expect(Math.max(...descriptorReads.map((read) => read.payloadBytes))).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(reads.some((read) => read.sql.includes("hex(substr"))).toBe(false)
  })

  test("exports sixteen remote-valid one-megabyte metadata rows within twenty-five queries", async () => {
    const { context, db, queryCount } = createCountingContext()
    const metadataJson = JSON.stringify("x".repeat(1_000_000))
    expect(new TextEncoder().encode(metadataJson).byteLength).toBe(1_000_002)
    await insertMinimalRemoteMetadataRows(db, {
      firstId: 1,
      count: 16,
      metadataJson,
    })
    const reads = observeAllReads(context)
    const before = queryCount()

    const rows = await new AuditEventRepository(context).export({ filters: {} })
    const csvBytes = new TextEncoder().encode(toAuditCsv(rows)).byteLength

    expect(rows).toHaveLength(16)
    expect(rows.every((row) => row.metadataJson === metadataJson)).toBe(true)
    expect(csvBytes).toBeLessThanOrEqual(AUDIT_CSV_MAX_BYTES)
    expect(reads.every((read) => read.payloadBytes <= 4 * 1024 * 1024)).toBe(true)
    expect(reads.every((read) => read.maxRowPayloadBytes < 2_000_000)).toBe(true)
    expect(queryCount() - before).toBe(11)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test("exports eight remote-valid near-two-megabyte metadata rows within twenty-five queries", async () => {
    const { context, db, queryCount } = createCountingContext()
    const metadataJson = JSON.stringify("x".repeat(1_998_000))
    expect(new TextEncoder().encode(metadataJson).byteLength).toBe(1_998_002)
    await insertMinimalRemoteMetadataRows(db, {
      firstId: 1,
      count: 8,
      metadataJson,
    })
    const reads = observeAllReads(context)
    const before = queryCount()

    const rows = await new AuditEventRepository(context).export({ filters: {} })
    const csvBytes = new TextEncoder().encode(toAuditCsv(rows)).byteLength

    expect(rows).toHaveLength(8)
    expect(rows.every((row) => row.metadataJson === metadataJson)).toBe(true)
    expect(csvBytes).toBeLessThanOrEqual(AUDIT_CSV_MAX_BYTES)
    expect(reads.every((read) => read.payloadBytes <= 4 * 1024 * 1024)).toBe(true)
    expect(reads.every((read) => read.maxRowPayloadBytes < 2_000_000)).toBe(true)
    expect(queryCount() - before).toBe(11)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test("globally batches mixed segmented and forty-six-thousand tiny rows within twenty-five queries", async () => {
    const { context, db, queryCount } = createCountingContext()
    const metadataJson = JSON.stringify("x".repeat(1_000_000))
    await insertMinimalRemoteMetadataRows(db, {
      firstId: 1,
      count: 14,
      metadataJson,
      createdAtOffset: 100_000,
    })
    await insertMinimalTinyRows(db, { firstId: 100, count: 46_000 })
    const reads = observeAllReads(context)
    const before = queryCount()

    const rows = await new AuditEventRepository(context).export({ filters: {} })
    const csvBytes = new TextEncoder().encode(toAuditCsv(rows)).byteLength

    expect(rows).toHaveLength(46_014)
    expect(rows.slice(0, 14).every((row) => row.metadataJson === metadataJson)).toBe(true)
    expect(csvBytes).toBeLessThanOrEqual(AUDIT_CSV_MAX_BYTES)
    expect(reads.every((read) => read.payloadBytes <= 4 * 1024 * 1024)).toBe(true)
    expect(reads.every((read) => read.maxRowPayloadBytes < 2_000_000)).toBe(true)
    expect(reads.every((read) => read.bindingCount <= 100)).toBe(true)
    expect(reads.every((read) => read.maxBindingBytes < 2_000_000)).toBe(true)
    expect(reads.every((read) => new TextEncoder().encode(read.sql).byteLength < 100_000)).toBe(
      true,
    )
    expect(
      reads
        .filter((read) => read.sql.includes("hex(substr"))
        .every((read) => read.bindingCount === 1),
    ).toBe(true)
    expect(queryCount() - before).toBe(19)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test("keeps remote-valid large segmented rows and export calls below D1 limits", async () => {
    const { context, db, queryCount } = createCountingContext()
    const metadataJson = JSON.stringify("値".repeat(600_000))
    expect(new TextEncoder().encode(metadataJson).byteLength).toBeLessThan(2_000_000)
    for (let id = 1; id <= 8; id += 1) {
      await insertLegacyRow(db, {
        id,
        eventId: `remote-large-${id}`,
        metadataJson,
        createdAt: id,
      })
    }
    const reads = observeAllReads(context)
    const before = queryCount()

    const rows = await new AuditEventRepository(context).export({ filters: {} })

    expect(rows).toHaveLength(8)
    expect(rows.every((row) => row.metadataJson === metadataJson)).toBe(true)
    expect(queryCount() - before).toBe(10)
    expect(reads.filter((read) => read.sql.includes("hex(substr"))).toHaveLength(8)
    expect(reads.every((read) => read.payloadBytes <= 4 * 1024 * 1024)).toBe(true)
    expect(reads.every((read) => read.maxRowPayloadBytes < 2_000_000)).toBe(true)
  }, LARGE_STRESS_TEST_TIMEOUT_MS)

  test("local-only >2 MB stress bounds detail reads before rejecting a multi-row export", async () => {
    const { context, db } = createTestContext()
    const largeJson = JSON.stringify("x".repeat(9 * 1024 * 1024))
    await insertLegacyRow(db, { id: 1, eventId: "large-1", metadataJson: largeJson, createdAt: 2 })
    await insertLegacyRow(db, { id: 2, eventId: "large-2", metadataJson: largeJson, createdAt: 1 })
    const reads = observeAllReads(context)

    const error = await rejectionOf(new AuditEventRepository(context).export({ filters: {} }))
    const descriptorReads = reads.filter((read) => read.sql.includes("cumulative_wire_bytes"))

    expect(error).toBeInstanceOf(PayloadTooLargeError)
    expect(Math.max(...reads.map((read) => read.payloadBytes))).toBeLessThanOrEqual(
      AUDIT_CSV_MAX_BYTES,
    )
    expect(reads.filter((read) => read.sql.includes("hex(substr"))).toHaveLength(0)
    expect(descriptorReads).toHaveLength(1)
    expect(descriptorReads[0]?.rowCount).toBe(2)
    expect(reads).toEqual(descriptorReads)
  })

  test("exports in fixed keyset chunks instead of one unbounded query", async () => {
    const { context, db, queryCount } = createCountingContext()
    await insertBulkRows(db, 1_001)
    const before = queryCount()

    const rows = await new AuditEventRepository(context).export({ filters: {} })

    expect(rows).toHaveLength(1_001)
    expect(queryCount() - before).toBeGreaterThan(1)
  })

  test("allows fifty thousand filtered rows within the D1 Free query budget, rejects the next, and counts after filtering", async () => {
    const { context, db, queryCount } = createCountingContext()
    const repository = new AuditEventRepository(context)
    await insertBulkRows(db, 50_000)

    Bun.gc(true)
    const memoryBefore = process.memoryUsage()
    const beforeSuccess = queryCount()
    let successRows = await repository.export({ filters: {} })
    expect(successRows).toHaveLength(50_000)
    expect(queryCount() - beforeSuccess).toBe(11)
    Bun.gc(true)
    const memoryAfter = process.memoryUsage()
    const retainedExportBytes =
      memoryAfter.heapUsed +
      memoryAfter.arrayBuffers -
      (memoryBefore.heapUsed + memoryBefore.arrayBuffers)
    expect(retainedExportBytes).toBeLessThan(64 * 1024 * 1024)
    successRows = []
    Bun.gc(true)

    await db
      .prepare(
        `INSERT INTO audit_events
           (id, event_id, request_id, action, outcome, client_name, created_at)
         VALUES (50001, 'bulk-50001', 'bulk-request-50001',
                 'legacy.bulk', 'succeeded', 'api', 50001)`,
      )
      .run()
    const beforeOverflow = queryCount()
    const observedReads = observeAllReads(context)
    expect(await rejectionOf(repository.export({ filters: {} }))).toBeInstanceOf(
      PayloadTooLargeError,
    )
    const descriptorReads = observedReads.filter((read) =>
      read.sql.includes("cumulative_wire_bytes"),
    )
    expect(descriptorReads.reduce((total, read) => total + read.rowCount, 0)).toBe(50_001)
    expect(descriptorReads.at(-1)?.rowCount).toBeGreaterThan(0)
    expect(queryCount() - beforeOverflow).toBe(11)
    expect(observedReads.length).toBeLessThanOrEqual(25)
    expect(observedReads.at(-1)).toBe(descriptorReads.at(-1))

    await db
      .prepare(
        `INSERT INTO audit_events
           (id, event_id, request_id, action, outcome, client_name, created_at)
         VALUES (50002, 'filtered-special', 'filtered-special-request',
                 'legacy.special', 'succeeded', 'api', 50002)`,
      )
      .run()

    const filtered = await repository.export({ filters: { action: "legacy.special" } })
    expect(filtered.map((row) => row.eventId)).toEqual(["filtered-special"])
  }, LARGE_STRESS_TEST_TIMEOUT_MS)
})
