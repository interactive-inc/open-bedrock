import { describe, expect, test } from "bun:test"
import type { AuditEventDetail, AuditEventRecord } from "@/domain/audit/audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { decodeAuditCursor } from "@/lib/audit/audit-cursor"
import { AUDIT_CSV_MAX_BYTES, toAuditCsv } from "@/lib/audit/audit-csv"
import { PayloadTooLargeError, UnavailableError, ValidationError } from "@/lib/errors"
import { schema } from "@/schema"
import { drizzle } from "drizzle-orm/d1"

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
      `INSERT INTO audit_logs
         (id, event_id, request_id, actor_account_id, actor_employee_id, action,
          target_type, target_id, outcome, reason_code, authorization_json,
          before_json, after_json, metadata_json, client_ip, client_name, created_at)
       VALUES (?1, ?2, ?3, ?4, 11, ?5, ?6, ?7, 'succeeded', ?8, ?9,
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
}

function observeAllReads(context: Context): ObservedAllRead[] {
  const reads: ObservedAllRead[] = []
  const source = context.env.DB
  const encoder = new TextEncoder()

  const wrapStatement = (statement: D1PreparedStatement, sql: string): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property) {
        if (property === "bind") {
          return (...values: unknown[]) => wrapStatement(target.bind(...values), sql)
        }
        if (property === "all") {
          return async () => {
            const result = await target.all()
            reads.push({
              sql,
              rowCount: result.results.length,
              payloadBytes: encoder.encode(JSON.stringify(result.results)).byteLength,
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

function tamperSegmentRead(
  context: Context,
  mode:
    | "failure"
    | "missing"
    | "changed-id"
    | "changed-created-at"
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
            const tamperAt = mode === "failure" ? 3 : 1
            if (tampered || segmentReadCount !== tamperAt) return result
            tampered = true

            if (mode === "failure") return { ...result, success: false }
            if (mode === "missing") return { ...result, results: [] }

            const [first, ...rest] = result.results
            if (typeof first !== "object" || first === null) return { ...result, results: [] }
            const row = first as Record<string, unknown>
            const chunkHex = row.chunk_hex
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
                  chunk_hex: `${mode === "invalid-hex" ? "GG" : "80"}${chunkHex.slice(2)}`,
                },
                ...rest,
              ],
            }
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
    INSERT INTO audit_logs
      (id, event_id, request_id, action, outcome, client_name, created_at)
    SELECT value, 'bulk-' || value, 'bulk-request-' || value,
           'legacy.bulk', 'succeeded', 'api', value
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
       INSERT INTO audit_logs
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

describe("AuditEventRepository write contract", () => {
  test("prepareAppend returns the inseparable insert and changed-row guard pair", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)

    const statements = repository.prepareAppend(record())
    expect(statements).toHaveLength(2)
    await db.batch([...statements])

    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE event_id = 'event-1'")
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
           FROM audit_logs WHERE event_id = ?1`,
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
      .prepare("SELECT target_id, typeof(target_id) AS type FROM audit_logs ORDER BY id")
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
      BEFORE INSERT ON audit_logs
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
      BEFORE INSERT ON audit_logs
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
      BEFORE INSERT ON audit_logs
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
            "INSERT INTO roles (key, name, is_system, created_at) VALUES ('admin', 'x', 0, 0)",
          ),
          ...repository.prepareAppend(record({ eventId: "must-not-remain" })),
        ]),
      ),
    ).toBeInstanceOf(Error)

    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE event_id = 'must-not-remain'")
        .first<number>("count"),
    ).toBe(0)
  })
})

describe("AuditEventRepository search contract", () => {
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
    expect(decodeAuditCursor(page.nextCursor ?? "").id).toBe(-7)
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

  test("preserves leading BOM text fields with a large segmented event ID on find and export", async () => {
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
        `INSERT INTO audit_logs
           (id, event_id, request_id, actor_account_id, actor_employee_id, action,
            target_type, target_id, outcome, reason_code, authorization_json,
            before_json, after_json, metadata_json, client_ip, client_name, created_at)
         VALUES (-1, ?1, ${bomText} || 'legacy-request', 7, 11,
                 ${bomText} || 'legacy.action', ${bomText} || 'legacy_target',
                 ${bomText} || 'legacy-target', 'succeeded',
                 ${bomText} || 'legacy_reason', ?2, ?3, ?4, ?5,
                 ${bomText} || '198.51.100.7', 'api', 1700000000)`,
      )
      .bind("e".repeat(4 * 1024 * 1024), authorizationJson, beforeJson, afterJson, metadataJson)
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

  test("rejects BOM-prefixed malformed metadata after a segmented find and export", async () => {
    const { context, db } = createTestContext()
    await db
      .prepare(
        `INSERT INTO audit_logs
           (id, event_id, request_id, actor_account_id, actor_employee_id, action,
            target_type, target_id, outcome, reason_code, authorization_json,
            before_json, after_json, metadata_json, client_ip, client_name, created_at)
         VALUES (-1, 'bom-invalid-json', 'legacy-request--1', 7, 11,
                 'legacy.unknown.action', 'legacy_target', 'legacy--1', 'succeeded',
                 'legacy_reason', '{"scope":"legacy"}', '{"state":"before"}',
                 '{"state":"after"}', CAST(X'EFBBBF' AS TEXT) || ?1,
                 '198.51.100.7', 'api', 1700000000)`,
      )
      .bind(JSON.stringify("x".repeat(4 * 1024 * 1024)))
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

  test("accepts exactly sixteen MiB and preserves a one-byte overflow as 413", async () => {
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
  })

  test("keeps every D1 response bounded when a quote-heavy valid JSON row still fits CSV", async () => {
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
    expect(segmentReads).toHaveLength(54)
    expect(reads.some((read) => read.sql.includes("json_each"))).toBe(false)
  })

  test.each([
    "failure",
    "missing",
    "changed-id",
    "changed-created-at",
    "invalid-hex",
    "invalid-utf8",
  ] as const)("maps a segmented %s response to safe 503", async (mode) => {
    const { context, db } = createTestContext()
    await insertLegacyRow(db, {
      eventId: `segment-${mode}`,
      metadataJson: JSON.stringify('"'.repeat(1_100_000)),
    })
    tamperSegmentRead(context, mode)

    await expectAuditUnavailable(new AuditEventRepository(context).export({ filters: {} }))
  })

  test("keeps normal exact-ID detail batches inside the cumulative wire budget", async () => {
    const { context, db } = createTestContext()
    const metadataJson = JSON.stringify('"'.repeat(600_000))
    await insertLegacyRow(db, { id: 1, eventId: "wire-1", metadataJson, createdAt: 2 })
    await insertLegacyRow(db, { id: 2, eventId: "wire-2", metadataJson, createdAt: 1 })
    const reads = observeAllReads(context)

    const rows = await new AuditEventRepository(context).export({ filters: {} })
    const exactReads = reads.filter((read) => read.sql.includes("json_each"))

    expect(rows.map((row) => row.eventId)).toEqual(["wire-1", "wire-2"])
    expect(exactReads).toHaveLength(2)
    expect(Math.max(...exactReads.map((read) => read.payloadBytes))).toBeLessThanOrEqual(
      4 * 1024 * 1024,
    )
    expect(reads.some((read) => read.sql.includes("hex(substr"))).toBe(false)
  })

  test("bounds every detail read before rejecting an oversized multi-row export", async () => {
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
    expect(reads.filter((read) => read.sql.includes("hex(substr"))).toHaveLength(49)
    expect(reads).toHaveLength(52)
    expect(descriptorReads).toHaveLength(2)
    expect(descriptorReads.at(-1)?.rowCount).toBe(1)
    expect(reads.at(-1)).toBe(descriptorReads.at(-1))
  })

  test("exports in fixed keyset chunks instead of one unbounded query", async () => {
    const { context, db, queryCount } = createCountingContext()
    await insertBulkRows(db, 1_001)
    const before = queryCount()

    const rows = await new AuditEventRepository(context).export({ filters: {} })

    expect(rows).toHaveLength(1_001)
    expect(queryCount() - before).toBeGreaterThan(1)
  })

  test("allows fifty thousand filtered rows, rejects the next, and counts after filtering", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)
    await insertBulkRows(db, 50_000)

    expect(await repository.export({ filters: {} })).toHaveLength(50_000)

    await db
      .prepare(
        `INSERT INTO audit_logs
           (id, event_id, request_id, action, outcome, client_name, created_at)
         VALUES (50001, 'bulk-50001', 'bulk-request-50001',
                 'legacy.bulk', 'succeeded', 'api', 50001)`,
      )
      .run()
    const observedReads = observeAllReads(context)
    expect(await rejectionOf(repository.export({ filters: {} }))).toBeInstanceOf(
      PayloadTooLargeError,
    )
    const descriptorReads = observedReads.filter((read) =>
      read.sql.includes("cumulative_raw_bytes"),
    )
    expect(descriptorReads.reduce((total, read) => total + read.rowCount, 0)).toBe(50_001)
    expect(descriptorReads.at(-1)?.rowCount).toBe(1)
    expect(observedReads).toHaveLength(201)
    expect(observedReads.at(-1)).toBe(descriptorReads.at(-1))

    await db
      .prepare(
        `INSERT INTO audit_logs
           (id, event_id, request_id, action, outcome, client_name, created_at)
         VALUES (50002, 'filtered-special', 'filtered-special-request',
                 'legacy.special', 'succeeded', 'api', 50002)`,
      )
      .run()

    const filtered = await repository.export({ filters: { action: "legacy.special" } })
    expect(filtered.map((row) => row.eventId)).toEqual(["filtered-special"])
  })
})
