import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { app } from "@/api/app"
import type { AuditEventDetail } from "@/api/http/audit/company-audit-event.definition"
import type { Bindings } from "@/env"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { toAuditCsv } from "@/api/http/audit/to-audit-csv"
import { AUDIT_CSV_MAX_BYTES } from "@/api/http/audit/to-audit-csv-row"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "audit-export-route-test-secret"
const now = "2026-01-03T00:00:00.000Z"
const exportRange = { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" }

type TestDb = { db: D1Database; resetQueries: () => void; queries: () => number }

async function createTestDb(withFixture = true): Promise<TestDb> {
  let queryCount = 0
  const db = createD1TestDatabase(loadSchema(), { onQuery: () => (queryCount += 1) })
  await seedCompanyEmployees(db, [
    { id: 1, code: "E001", name: "Admin", status: "active" },
    { id: 2, code: "E002", name: "Reader", status: "active" },
    { id: 3, code: "E003", name: "Exporter", status: "active" },
    { id: 4, code: "E004", name: "Member", status: "active" },
  ])
  await seedIamForEmployees(db, [
    { id: 1, email: "you+e001@example.com", passwordHash: "hash", role: "root" },
    { id: 2, email: "you+e002@example.com", passwordHash: "hash", role: "member" },
    { id: 3, email: "you+e003@example.com", passwordHash: "hash", role: "member" },
    { id: 4, email: "you+e004@example.com", passwordHash: "hash", role: "member" },
  ])
  await grantPermission(db, 2, "export-read-only", "audit:read")
  await grantPermission(db, 3, "export-only", "audit:export")
  if (withFixture) await seedExportRow(db)
  await initializeStandardCompanyTestState(db)

  return {
    db,
    resetQueries: () => (queryCount = 0),
    queries: () => queryCount,
  }
}

async function grantPermission(
  db: D1Database,
  accountId: number,
  roleKey: string,
  permission: "audit:read" | "audit:export",
): Promise<void> {
  const roleId = `test:${roleKey}`
  await db.batch([
    db
      .prepare(
        `INSERT INTO system_iam_roles
           (id, key, kind, name, description, created_at, updated_at)
         VALUES (?1, ?2, 'custom', ?3, NULL, 0, 0)`,
      )
      .bind(roleId, `company:${roleKey}`, roleKey),
    db
      .prepare(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES (?1, ?2)`,
      )
      .bind(roleId, permission),
    db
      .prepare(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES (?1, ?2, ?3, NULL, NULL, 0, NULL)`,
      )
      .bind(`test:${accountId}:${roleKey}`, String(accountId), roleId),
  ])
}

async function seedExportRow(db: D1Database): Promise<void> {
  await db
    .prepare(
      `INSERT INTO company_audit_events
       (event_id, request_id, actor_account_id, action, target_type,
        target_id, outcome, reason_code, authorization_json, before_json, after_json,
        metadata_json, client_ip, client_name, created_at)
       VALUES ('custom-41', 'custom-request', -41, 'custom.action', 'custom_target',
               '=formula', 'succeeded', 'custom_reason', '7', '"before"', '[1,2]',
               '{"custom_text":"value"}', '192.0.2.41', 'cli', 1767225600)`,
    )
    .run()
}

function token(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(employeeId) })
}

function request(
  db: D1Database,
  bearer: string | null,
  body: unknown = exportRange,
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/company/audit-event-exports",
    token: bearer,
    method: "POST",
    body,
    now,
  })
}

function bindings(db: D1Database): Bindings {
  return {
    DB: db,
    JWT_SECRET: jwtSecret,
    AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    NOW: now,
  }
}

function streamOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function exactSizedJson(size: number): string {
  const json = JSON.stringify(exportRange)
  if (json.length > size) throw new Error("fixture size is too small")
  return `${json}${" ".repeat(size - json.length)}`
}

function rawRequest(
  db: D1Database,
  bearer: string | null,
  body: BodyInit,
  headers: Record<string, string> = {},
  path = "/company/audit-event-exports",
): Promise<Response> {
  const requestHeaders: Record<string, string> = { "content-type": "application/json", ...headers }
  if (bearer !== null) requestHeaders.Authorization = `Bearer ${bearer}`

  return Promise.resolve(
    app.request(path, { method: "POST", headers: requestHeaders, body }, bindings(db)),
  )
}

async function latestAudit(db: D1Database): Promise<Record<string, unknown>> {
  const row = await db
    .prepare("SELECT * FROM company_audit_events ORDER BY id DESC LIMIT 1")
    .first()
  if (row === null) throw new Error("missing audit event")
  return row as Record<string, unknown>
}

async function countAuditRows(db: D1Database): Promise<number> {
  return (
    (await db
      .prepare("SELECT count(*) AS count FROM company_audit_events")
      .first<number>("count")) ?? -1
  )
}

async function failSelfAudit(db: D1Database): Promise<void> {
  await db.exec(`CREATE TRIGGER fail_audit_self_insert
    BEFORE INSERT ON company_audit_events
    WHEN NEW.action LIKE 'audit.event.%'
    BEGIN SELECT RAISE(ABORT, 'self audit disabled'); END;`)
}

async function insertBulkRows(db: D1Database, count: number): Promise<void> {
  await db.exec(`
    WITH RECURSIVE sequence(value) AS (
      SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < ${count}
    )
    INSERT INTO company_audit_events
      (id, event_id, request_id, action, outcome, client_name, created_at)
    SELECT value, 'custom-' || (100000 + value), 'r' || value,
           'custom.bulk', 'succeeded', 'api', 1767225600 + value
    FROM sequence
  `)
}

async function insertFormalWorstRows(db: D1Database): Promise<void> {
  const metadata = JSON.stringify("x".repeat(1_000_000))
  const statement = db.prepare(
    `INSERT INTO company_audit_events
       (id, event_id, request_id, action, outcome, metadata_json, client_name, created_at)
     VALUES (?1, ?2, 'r', 'a', 'succeeded', ?3, 'api', ?4)`,
  )
  for (let index = 0; index < 14; index += 1) {
    await statement.bind(index + 1, `l${index + 1}`, metadata, 100_001 + index).run()
  }
  await db.exec(`
    WITH RECURSIVE sequence(value) AS (
      SELECT 100 UNION ALL SELECT value + 1 FROM sequence WHERE value < 46099
    )
    INSERT INTO company_audit_events
      (id, event_id, request_id, action, outcome, client_name, created_at)
    SELECT value, CAST(value AS TEXT), 'r', 'a', 'succeeded', 'api', value
    FROM sequence
  `)
}

async function insertOneByteCsvOverflow(db: D1Database): Promise<void> {
  const rowCount = 9
  const createdAtBase = 1_767_225_600
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
      createdAt: createdAtBase + id,
    }
  })
  const baseBytes = new TextEncoder().encode(toAuditCsv(emptyRows)).byteLength
  const contentBytes = AUDIT_CSV_MAX_BYTES - baseBytes
  const contentLengths = Array.from(
    { length: rowCount },
    (_, index) => Math.floor(contentBytes / rowCount) + (index < contentBytes % rowCount ? 1 : 0),
  )
  const statement = db.prepare(
    `INSERT INTO company_audit_events
       (id, event_id, request_id, action, outcome, metadata_json, client_name, created_at)
     VALUES (?1, ?2, 'r', 'a', 'succeeded', ?3, 'api', ?4)`,
  )

  expect(baseBytes + contentLengths.reduce((total, length) => total + length, 0) + 1).toBe(
    AUDIT_CSV_MAX_BYTES + 1,
  )
  for (const [index, contentLength] of contentLengths.entries()) {
    const id = index + 1
    await statement
      .bind(
        id,
        `l${id}`,
        JSON.stringify("x".repeat(contentLength + (index === rowCount - 1 ? 1 : 0))),
        createdAtBase + id,
      )
      .run()
  }
}

describe("POST /audit-event-exports", () => {
  test("authorizes export independently from read", async () => {
    const { db } = await createTestDb()

    expect((await request(db, await token(1))).status).toBe(200)
    expect((await request(db, await token(3))).status).toBe(200)
    expect((await request(db, await token(2))).status).toBe(403)
    expect((await request(db, await token(4))).status).toBe(403)
  })

  test("rejects malformed strict export ranges without self-auditing", async () => {
    const invalidBodies: ReadonlyArray<unknown> = [
      {},
      { from: exportRange.from },
      { to: exportRange.to },
      { ...exportRange, unknown: true },
      [],
      null,
      { from: exportRange.from, to: exportRange.from },
      { from: exportRange.to, to: exportRange.from },
      { from: "2026-01-01T00:00:00.000Z", to: exportRange.to },
      { from: exportRange.from, to: "2026-02-01T00:00:01Z" },
    ]

    for (const body of invalidBodies) {
      const { db } = await createTestDb()
      const before = await countAuditRows(db)
      const response = await request(db, await token(3), body)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: "audit export range is invalid",
        code: "audit_invalid_export_range",
      })
      expect(await countAuditRows(db)).toBe(before)
      expect(response.headers.get("Content-Disposition")).toBeNull()
      expect(response.headers.get("Content-Type")).toContain("application/json")
    }
  })

  test("rejects broken JSON and a non-object body with the fixed safe code", async () => {
    for (const raw of ["{", "null", "[]"] as const) {
      const { db } = await createTestDb()
      const response = await rawRequest(db, await token(3), raw)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: "audit_invalid_export_range" })
      expect(response.headers.get("Content-Disposition")).toBeNull()
    }
  })

  test("fails closed before audit validation when the shared request clock is invalid", async () => {
    const { db } = await createTestDb()
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/company/audit-event-exports",
      token: await token(3),
      method: "POST",
      body: { from: exportRange.from },
      now: "not-a-date",
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: "account authorization is unavailable",
    })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  test("counts the actual body stream, accepts exactly 16 KiB and rejects 16 KiB plus one", async () => {
    const exactDb = await createTestDb()
    const exact = await rawRequest(exactDb.db, await token(3), streamOf(exactSizedJson(16_384)))
    expect(exact.status).toBe(200)

    const overDb = await createTestDb()
    const before = await countAuditRows(overDb.db)
    const over = await rawRequest(overDb.db, await token(3), streamOf(exactSizedJson(16_385)))
    expect(over.status).toBe(400)
    expect(await over.json()).toMatchObject({ code: "audit_invalid_export_range" })
    expect(await countAuditRows(overDb.db)).toBe(before)
  })

  test("does not trust Content-Length and does not read a body before auth or permission", async () => {
    const authorized = await createTestDb()
    const spoofed = await rawRequest(
      authorized.db,
      await token(3),
      streamOf(exactSizedJson(16_385)),
      { "Content-Length": "1" },
    )
    expect(spoofed.status).toBe(400)
    expect(await spoofed.json()).toMatchObject({ code: "audit_invalid_export_range" })

    const unread = () =>
      new ReadableStream<Uint8Array>({
        pull() {
          throw new Error("body must not be read")
        },
      })
    const unauthenticated = await createTestDb()
    expect((await rawRequest(unauthenticated.db, null, unread())).status).toBe(401)

    const forbidden = await createTestDb()
    expect((await rawRequest(forbidden.db, await token(4), unread())).status).toBe(403)
    expect(await latestAudit(forbidden.db)).toMatchObject({
      outcome: "denied",
      target_id: null,
      metadata_json: '{"format":"csv"}',
    })
  })

  test("skips the global one-megabyte guard only for the exact export path", async () => {
    const { db } = await createTestDb()
    const huge = streamOf(" ".repeat(1_000_001))
    const exact = await rawRequest(db, null, huge)
    expect(exact.status).toBe(401)

    const nearby = await rawRequest(
      db,
      null,
      streamOf(" ".repeat(1_000_001)),
      {},
      "/company/audit-event-exports/nearby",
    )
    expect(nearby.status).toBe(413)
  })

  test("exports the fixed sixteen-column RFC 4180 CSV only after self-audit", async () => {
    const { db } = await createTestDb()
    const response = await request(db, await token(3), {
      ...exportRange,
      actor_account_id: "-41",
      action: "custom.action",
      target_type: "custom_target",
      target_id: "=formula",
      outcome: "succeeded",
    })
    const csv = await response.text()
    const lines = csv.split("\r\n")
    const audit = await latestAudit(db)
    const metadata = JSON.parse(String(audit.metadata_json)) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="audit-events.csv"',
    )
    expect(response.headers.get("Content-Length")).toBeNull()
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(audit.request_id).toBe(response.headers.get("X-Request-ID"))
    expect(csv.startsWith("\uFEFF")).toBe(false)
    expect(lines[0]?.split(",")).toHaveLength(16)
    expect(lines[0]).toBe(
      "event_id,request_id,actor_account_id,actor_employee_id,action,target_type,target_id,outcome,reason_code,authorization_json,before_json,after_json,metadata_json,client_ip,client_name,created_at",
    )
    expect(csv).toContain("'=formula")
    expect(csv.endsWith("\r\n")).toBe(true)
    expect(audit).toMatchObject({
      action: "audit.event.exported",
      target_type: "audit_export",
      target_id: null,
      outcome: "succeeded",
      reason_code: null,
      authorization_json: '{"permission_keys":["audit:export"]}',
    })
    expect(Object.keys(metadata).sort()).toEqual(["filter_hash", "format", "result_count"])
    expect(metadata).toMatchObject({ format: "csv", result_count: 1 })
    expect(String(audit.metadata_json)).not.toContain("=formula")
  })

  test("exports an empty matching range with only the fixed header", async () => {
    const { db } = await createTestDb(false)
    const response = await request(db, await token(3))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(csv.split("\r\n")).toHaveLength(2)
  })

  test("turns 50,001 rows into audited JSON 413 within the full-request budget", async () => {
    const state = await createTestDb(false)
    await insertBulkRows(state.db, 50_001)
    state.resetQueries()

    const response = await request(state.db, await token(3))
    const requestQueries = state.queries()
    const audit = await latestAudit(state.db)

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({
      error: "audit export is too large",
      code: "audit_export_too_large",
    })
    expect(response.headers.get("Content-Disposition")).toBeNull()
    expect(response.headers.get("Content-Type")).toContain("application/json")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(audit).toMatchObject({
      action: "audit.event.exported",
      target_type: "audit_export",
      target_id: null,
      outcome: "failed",
      reason_code: "audit_export_too_large",
    })
    expect(JSON.parse(String(audit.metadata_json))).toMatchObject({ format: "csv" })
    expect(requestQueries).toBe(23)
    expect(requestQueries).toBeLessThanOrEqual(28)
    expect(requestQueries).toBeLessThanOrEqual(33)
  }, 20_000)

  test("rejects a one-byte CSV overflow without leaking bytes and fails closed on self-audit", async () => {
    const state = await createTestDb(false)
    await insertOneByteCsvOverflow(state.db)

    const response = await request(state.db, await token(3))
    const payload = await response.text()
    const audit = await latestAudit(state.db)

    expect(response.status).toBe(413)
    expect(JSON.parse(payload)).toEqual({
      error: "audit export is too large",
      code: "audit_export_too_large",
    })
    expect(payload).not.toContain("event_id,request_id")
    expect(response.headers.get("Content-Disposition")).toBeNull()
    expect(response.headers.get("Content-Type")).toContain("application/json")
    expect(audit).toMatchObject({
      action: "audit.event.exported",
      outcome: "failed",
      reason_code: "audit_export_too_large",
    })

    await failSelfAudit(state.db)
    const unavailable = await request(state.db, await token(3))
    const unavailablePayload = await unavailable.text()

    expect(unavailable.status).toBe(503)
    expect(JSON.parse(unavailablePayload)).toMatchObject({ code: "audit_unavailable" })
    expect(unavailablePayload).not.toContain("event_id,request_id")
    expect(unavailable.headers.get("Content-Disposition")).toBeNull()
  }, 20_000)

  test("keeps 50,000 rows and the formal worst shape within their full-request budgets", async () => {
    const fiftyThousand = await createTestDb(false)
    await insertBulkRows(fiftyThousand.db, 50_000)
    fiftyThousand.resetQueries()
    const success = await request(fiftyThousand.db, await token(3))
    expect(success.status).toBe(200)
    expect(fiftyThousand.queries()).toBe(23)
    expect(fiftyThousand.queries()).toBeLessThanOrEqual(28)
    expect(fiftyThousand.queries()).toBeLessThanOrEqual(33)

    const formalWorst = await createTestDb(false)
    await insertFormalWorstRows(formalWorst.db)
    formalWorst.resetQueries()
    const worst = await request(formalWorst.db, await token(3), {
      from: "1970-01-01T00:00:00Z",
      to: "1970-02-01T00:00:00Z",
    })
    expect(worst.status).toBe(200)
    expect(formalWorst.queries()).toBe(31)
    expect(formalWorst.queries()).toBeLessThanOrEqual(33)
  }, 20_000)

  test("prioritizes unavailable over success, overflow and denied outcomes", async () => {
    const success = await createTestDb()
    await failSelfAudit(success.db)
    const successResponse = await request(success.db, await token(3))
    expect(successResponse.status).toBe(503)
    expect(await successResponse.json()).toMatchObject({ code: "audit_unavailable" })
    expect(successResponse.headers.get("Content-Disposition")).toBeNull()

    const overflow = await createTestDb(false)
    await insertBulkRows(overflow.db, 50_001)
    await failSelfAudit(overflow.db)
    const overflowResponse = await request(overflow.db, await token(3))
    expect(overflowResponse.status).toBe(503)
    expect(await overflowResponse.json()).toMatchObject({ code: "audit_unavailable" })
    expect(overflowResponse.headers.get("Content-Disposition")).toBeNull()

    const denied = await createTestDb()
    await failSelfAudit(denied.db)
    const deniedResponse = await request(denied.db, await token(4))
    expect(deniedResponse.status).toBe(503)
    expect(await deniedResponse.json()).toMatchObject({ code: "audit_unavailable" })
  }, 20_000)

  test("exposes request and disposition headers on CORS preflight and response", async () => {
    const { db } = await createTestDb()
    const preflight = await app.request(
      "/company/audit-event-exports",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
        },
      },
      bindings(db),
    )
    const response = await rawRequest(db, await token(3), JSON.stringify(exportRange), {
      Origin: "http://localhost:3000",
    })

    for (const current of [preflight, response]) {
      expect(current.headers.get("Access-Control-Expose-Headers")).toContain("X-Request-ID")
      expect(current.headers.get("Access-Control-Expose-Headers")).toContain("Content-Disposition")
      expect(current.headers.get("Cache-Control")).toBe("no-store")
    }
  })
})
