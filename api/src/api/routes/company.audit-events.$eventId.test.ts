import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "audit-detail-route-test-secret"
const now = "2026-01-03T00:00:00.000Z"
const uuid = "12345678-1234-4abc-8def-1234567890ab"
const secondUuid = "22345678-1234-4abc-8def-1234567890ab"
const thirdUuid = "32345678-1234-4abc-8def-1234567890ab"
const missingUuid = "42345678-1234-4abc-8def-1234567890ab"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
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
  await grantPermission(db, 2, "detail-reader", "audit:read")
  await grantPermission(db, 3, "detail-exporter", "audit:export")
  await seedDetail(db, uuid, 1_767_225_600)
  await seedDetail(db, secondUuid, 1_767_225_601)
  await seedDetail(db, thirdUuid, 1_767_225_602)
  await initializeStandardCompanyTestState(db)

  return db
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

async function seedDetail(db: D1Database, eventId: string, createdAt: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO company_audit_events
       (event_id, request_id, actor_account_id, action, target_type,
        target_id, outcome, reason_code, authorization_json, before_json, after_json,
        metadata_json, client_ip, client_name, created_at)
       VALUES (?1, 'request with spaces', -41, 'custom.action', 'custom_target', NULL,
               'succeeded', 'custom_reason', '7', '"stored before"', '[1,2]',
               '{"custom_text":"private"}', '192.0.2.41', 'cli', ?2)`,
    )
    .bind(eventId, createdAt)
    .run()
}

function token(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(employeeId) })
}

function request(db: D1Database, eventId: string, bearer: string | null): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: `/company/audit-events/${eventId}`,
    token: bearer,
    now,
  })
}

async function latestAudit(db: D1Database): Promise<Record<string, unknown>> {
  const row = await db
    .prepare("SELECT * FROM company_audit_events ORDER BY id DESC LIMIT 1")
    .first()
  if (row === null) throw new Error("missing audit event")
  return row as Record<string, unknown>
}

async function failSelfAudit(db: D1Database): Promise<void> {
  await db.exec(`CREATE TRIGGER fail_audit_self_insert
    BEFORE INSERT ON company_audit_events
    WHEN NEW.action LIKE 'audit.event.%'
    BEGIN SELECT RAISE(ABORT, 'self audit disabled'); END;`)
}

describe("GET /audit-events/:eventId", () => {
  test("authorizes read independently from export and authentication", async () => {
    const db = await createTestDb()

    expect((await request(db, uuid, await token(1))).status).toBe(200)
    expect((await request(db, uuid, await token(2))).status).toBe(200)
    expect((await request(db, uuid, await token(3))).status).toBe(403)
    expect((await request(db, uuid, await token(4))).status).toBe(403)
    expect((await request(db, uuid, null)).status).toBe(401)
  })

  test.each([uuid, secondUuid, thirdUuid])(
    "returns a UUID-addressed detail without rewriting stored JSON: %s",
    async (eventId) => {
      const db = await createTestDb()
      const response = await request(db, eventId, await token(2))
      const body = (await response.json()) as Record<string, unknown>

      expect(response.status).toBe(200)
      expect(body).toMatchObject({
        event_id: eventId,
        request_id: "request with spaces",
        actor_account_id: "-41",
        actor_employee_id: null,
        action: "custom.action",
        target_type: "custom_target",
        target_id: null,
        outcome: "succeeded",
        reason_code: "custom_reason",
        authorization_json: "7",
        before_json: '"stored before"',
        after_json: "[1,2]",
        metadata_json: '{"custom_text":"private"}',
        client_ip: "192.0.2.41",
        client_name: "cli",
        created_at: expect.stringMatching(/^2026-01-01T00:00:0[0-2]\.000Z$/u),
      })
      expect(body).not.toHaveProperty("id")
      expect(body).not.toHaveProperty("actor_name")
      expect(body).not.toHaveProperty("role")
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    },
  )

  test("makes malformed and missing IDs indistinguishable after authorization", async () => {
    const db = await createTestDb()
    const malformed = await request(db, "NOT-A-UUID", await token(2))
    const missing = await request(db, missingUuid, await token(2))

    expect(malformed.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await malformed.json()).toEqual({
      error: "audit event was not found",
      code: "audit_event_not_found",
    })
    expect(await missing.json()).toEqual({
      error: "audit event was not found",
      code: "audit_event_not_found",
    })
    expect(malformed.headers.get("Cache-Control")).toBe("no-store")
    expect(missing.headers.get("Cache-Control")).toBe("no-store")
  })

  test("fails closed before detail validation when the shared request clock is invalid", async () => {
    const db = await createTestDb()
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/company/audit-events/PRIVATE-MALFORMED",
      token: await token(2),
      now: "not-a-date",
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: "account authorization is unavailable",
    })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  test("sets no-store on an unmatched malformed audit subtree path", async () => {
    const db = await createTestDb()
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/company/audit-events/private/extra",
      token: await token(2),
      now,
    })

    expect(response.status).toBe(404)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  test("audits an existing and a missing detail before returning", async () => {
    const existingDb = await createTestDb()
    const existing = await request(existingDb, secondUuid, await token(2))
    const existingAudit = await latestAudit(existingDb)
    expect(existing.status).toBe(200)
    expect(existingAudit).toMatchObject({
      request_id: existing.headers.get("X-Request-ID"),
      action: "audit.event.read",
      target_type: "audit_event",
      target_id: secondUuid,
      outcome: "succeeded",
      metadata_json: '{"format":"json","result_count":1}',
    })
    expect(String(existingAudit.metadata_json)).not.toContain("private")

    const missingDb = await createTestDb()
    const missing = await request(missingDb, missingUuid, await token(2))
    const missingAudit = await latestAudit(missingDb)
    expect(missing.status).toBe(404)
    expect(missingAudit).toMatchObject({
      action: "audit.event.read",
      target_type: "audit_event",
      target_id: missingUuid,
      outcome: "succeeded",
      metadata_json: '{"format":"json","result_count":0}',
    })
  })

  test("audits denied malformed and overlong paths without copying the path", async () => {
    for (const eventId of ["PRIVATE-MALFORMED", "p".repeat(65)]) {
      const db = await createTestDb()
      const response = await request(db, eventId, await token(4))
      const audit = await latestAudit(db)

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: "audit_read_forbidden" })
      expect(audit).toMatchObject({
        action: "audit.event.read",
        target_type: "audit_event",
        target_id: null,
        outcome: "denied",
        reason_code: "permission_denied",
        authorization_json: '{"required_permission_keys":["audit:read"]}',
        metadata_json: '{"format":"json"}',
      })
      expect(JSON.stringify(audit)).not.toContain(eventId)
    }
  })

  test("prioritizes unavailable over existing, not-found and denied responses", async () => {
    for (const [eventId, employeeId] of [
      [uuid, 2],
      [missingUuid, 2],
      ["PRIVATE-MALFORMED", 4],
    ] as const) {
      const db = await createTestDb()
      await failSelfAudit(db)
      const response = await request(db, eventId, await token(employeeId))

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error: "audit events are unavailable",
        code: "audit_unavailable",
      })
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    }
  })
})
