import { describe, expect, test } from "bun:test"
import { app } from "@/app"
import type { Bindings } from "@/env"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"

const jwtSecret = "audit-list-route-test-secret"
const now = "2026-01-03T00:00:00.000Z"

type TestDb = { db: D1Database; resetQueries: () => void; queries: () => number }

async function createTestDb(): Promise<TestDb> {
  let queryCount = 0
  const db = createD1TestDatabase(loadSchema(), { onQuery: () => (queryCount += 1) })

  await seedD1(db, "employees", [
    { id: 1, code: "E001", name: "Admin", status: "active" },
    { id: 2, code: "E002", name: "Reader", status: "active" },
    { id: 3, code: "E003", name: "Exporter", status: "active" },
    { id: 4, code: "E004", name: "Member", status: "active" },
  ])
  await seedIamForEmployees(db, [
    { id: 1, email: "you+e001@example.com", passwordHash: "hash", role: "admin" },
    { id: 2, email: "you+e002@example.com", passwordHash: "hash", role: "member" },
    { id: 3, email: "you+e003@example.com", passwordHash: "hash", role: "member" },
    { id: 4, email: "you+e004@example.com", passwordHash: "hash", role: "member" },
  ])
  await grantPermission(db, 2, "audit-reader", "audit:read")
  await grantPermission(db, 3, "audit-exporter", "audit:export")
  await seedAuditEvent(db, {
    eventId: "12345678-1234-4abc-8def-1234567890ab",
    requestId: "legacy-request-1",
    actorAccountId: -41,
    action: "legacy.action",
    targetType: "legacy_target",
    targetId: "private-target",
    outcome: "succeeded",
    createdAt: 1_767_225_600,
  })
  await seedAuditEvent(db, {
    eventId: "12345678-1234-4abc-8def-1234567890ac",
    requestId: "legacy-request-2",
    actorAccountId: 1,
    action: "iam.role.created",
    targetType: "role",
    targetId: "2",
    outcome: "failed",
    createdAt: 1_767_312_000,
  })

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
  await db
    .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?1, 0, 0)")
    .bind(roleKey)
    .run()
  await db
    .prepare(
      "INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.key = ?1 AND p.key = ?2",
    )
    .bind(roleKey, permission)
    .run()
  await db
    .prepare(
      "INSERT INTO account_roles (account_id, role_id, granted_at) SELECT ?1, id, 0 FROM roles WHERE key = ?2",
    )
    .bind(accountId, roleKey)
    .run()
}

async function seedAuditEvent(
  db: D1Database,
  input: {
    eventId: string
    requestId: string
    actorAccountId: number | null
    action: string
    targetType: string | null
    targetId: string | null
    outcome: "succeeded" | "denied" | "failed"
    createdAt: number
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs
       (event_id, request_id, actor_account_id, actor_employee_id, action, target_type,
        target_id, outcome, reason_code, authorization_json, before_json, after_json,
        metadata_json, client_ip, client_name, created_at)
       VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, 'legacy_reason',
               '{"legacy":true}', '{"before":1}', '{"after":2}',
               '{"private":"value"}', '192.0.2.10', 'api', ?8)`,
    )
    .bind(
      input.eventId,
      input.requestId,
      input.actorAccountId,
      input.action,
      input.targetType,
      input.targetId,
      input.outcome,
      input.createdAt,
    )
    .run()
}

function token(employeeId: number, role = "member"): Promise<string> {
  return createTestToken(jwtSecret, { employeeId, role })
}

function request(db: D1Database, path: string, bearer: string | null): Promise<Response> {
  return requestWithContext({ db, jwtSecret, path, token: bearer, now })
}

async function latestAudit(db: D1Database): Promise<Record<string, unknown>> {
  const row = await db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1").first()
  if (row === null) throw new Error("missing audit event")
  return row as Record<string, unknown>
}

async function failSelfAudit(db: D1Database): Promise<void> {
  await db.exec(`CREATE TRIGGER fail_audit_self_insert
    BEFORE INSERT ON audit_logs
    WHEN NEW.action LIKE 'audit.event.%'
    BEGIN SELECT RAISE(ABORT, 'self audit disabled'); END;`)
}

describe("GET /audit-events", () => {
  test("authorizes by live audit:read permission, independently of roles and export", async () => {
    const { db } = await createTestDb()

    expect((await request(db, "/audit-events", await token(1))).status).toBe(200)
    expect((await request(db, "/audit-events", await token(2))).status).toBe(200)
    expect((await request(db, "/audit-events", await token(3))).status).toBe(403)
    expect((await request(db, "/audit-events", await token(4, "admin"))).status).toBe(403)
  })

  test("applies grants and revocations after token issuance", async () => {
    const { db } = await createTestDb()
    const bearer = await token(4)

    expect((await request(db, "/audit-events", bearer)).status).toBe(403)
    await grantPermission(db, 4, "late-reader", "audit:read")
    expect((await request(db, "/audit-events", bearer)).status).toBe(200)
    await db
      .prepare(
        "DELETE FROM account_roles WHERE account_id = 4 AND role_id = (SELECT id FROM roles WHERE key = 'late-reader')",
      )
      .run()
    expect((await request(db, "/audit-events", bearer)).status).toBe(403)
  })

  test("filters legacy vocabulary in a half-open range and paginates only with opaque cursors", async () => {
    const { db } = await createTestDb()
    const bearer = await token(1)
    const filtered = await request(
      db,
      "/audit-events?actor_account_id=-41&action=legacy.action&target_type=legacy_target&target_id=private-target&outcome=succeeded&from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z",
      bearer,
    )
    const filteredBody = (await filtered.json()) as { data: Array<{ event_id: string }> }

    expect(filtered.status).toBe(200)
    expect(filteredBody.data.map((item) => item.event_id)).toEqual([
      "12345678-1234-4abc-8def-1234567890ab",
    ])

    const first = await request(db, "/audit-events?limit=1", bearer)
    const firstBody = (await first.json()) as {
      data: Array<{ event_id: string }>
      next_cursor: string | null
      previous_cursor: string | null
    }
    expect(firstBody.next_cursor).not.toBeNull()
    expect(firstBody.previous_cursor).toBeNull()

    const second = await request(
      db,
      `/audit-events?limit=1&cursor=${encodeURIComponent(firstBody.next_cursor ?? "")}`,
      bearer,
    )
    const secondBody = (await second.json()) as {
      data: Array<{ event_id: string }>
      previous_cursor: string | null
    }
    expect(second.status).toBe(200)
    expect(secondBody.previous_cursor).not.toBeNull()
    expect(secondBody.data[0]?.event_id).not.toBe(firstBody.data[0]?.event_id)

    const rebound = await request(
      db,
      `/audit-events?limit=2&cursor=${encodeURIComponent(firstBody.next_cursor ?? "")}`,
      bearer,
    )
    expect(rebound.status).toBe(400)
    expect(await rebound.json()).toMatchObject({ code: "invalid_audit_cursor" })

    const filterRebound = await request(
      db,
      `/audit-events?limit=1&action=legacy.changed&cursor=${encodeURIComponent(firstBody.next_cursor ?? "")}`,
      bearer,
    )
    expect(filterRebound.status).toBe(400)
    expect(await filterRebound.json()).toMatchObject({ code: "invalid_audit_cursor" })
  })

  test("rejects malformed queries before SQL and leaves no self-audit", async () => {
    const state = await createTestDb()
    const bearer = await token(1)
    state.resetQueries()
    const before = await state.db.prepare("SELECT count(*) AS count FROM audit_logs").first("count")
    state.resetQueries()

    const response = await request(state.db, "/audit-events?limit=1&limit=1", bearer)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "audit_invalid_query" })
    expect(state.queries()).toBe(6)
    const after = await state.db.prepare("SELECT count(*) AS count FROM audit_logs").first("count")
    expect(after).toBe(before)
  })

  test.each(["", "not-a-version-two-cursor"])(
    "rejects a malformed opaque cursor before repository SQL: %s",
    async (cursor) => {
      const state = await createTestDb()
      state.resetQueries()

      const response = await request(
        state.db,
        `/audit-events?cursor=${encodeURIComponent(cursor)}`,
        await token(1),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: "invalid_audit_cursor" })
      expect(state.queries()).toBe(6)
    },
  )

  test("does not expose internal, JSON, IP or mutable identity fields", async () => {
    const { db } = await createTestDb()
    const response = await request(db, "/audit-events?action=legacy.action", await token(1))
    const body = (await response.json()) as { data: Array<Record<string, unknown>> }
    const item = body.data[0] ?? {}

    expect(response.status).toBe(200)
    expect(item.created_at).toBe("2026-01-01T00:00:00.000Z")
    for (const key of [
      "id",
      "client_ip",
      "authorization_json",
      "before_json",
      "after_json",
      "metadata_json",
      "actor_name",
      "role",
    ]) {
      expect(item).not.toHaveProperty(key)
    }
  })

  test("appends a bounded searched event after reading and correlates its request ID", async () => {
    const { db } = await createTestDb()
    const response = await request(
      db,
      "/audit-events?target_id=private-target&limit=1",
      await token(1),
    )
    const body = (await response.json()) as { data: Array<{ event_id: string }> }
    const audit = await latestAudit(db)
    const metadata = JSON.parse(String(audit.metadata_json)) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.data.map((item) => item.event_id)).not.toContain(audit.event_id)
    expect(audit.request_id).toBe(response.headers.get("X-Request-ID"))
    expect(audit).toMatchObject({
      action: "audit.event.searched",
      target_type: "audit_event",
      target_id: null,
      outcome: "succeeded",
      reason_code: null,
    })
    expect(Object.keys(metadata).sort()).toEqual([
      "filter_hash",
      "format",
      "requested_limit",
      "result_count",
    ])
    expect(metadata).toMatchObject({ format: "json", requested_limit: 1 })
    expect(String(audit.metadata_json)).not.toContain("private-target")
  })

  test("audits a denied malformed query without validating or copying it", async () => {
    const { db } = await createTestDb()
    const response = await request(
      db,
      "/audit-events?direction=private-direction&target_id=private-target",
      await token(4),
    )
    const audit = await latestAudit(db)

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: "audit_read_forbidden" })
    expect(audit).toMatchObject({
      action: "audit.event.searched",
      target_type: "audit_event",
      target_id: null,
      outcome: "denied",
      reason_code: "permission_denied",
      authorization_json: '{"required_permission_keys":["audit:read"]}',
      metadata_json: '{"format":"json"}',
    })
    expect(JSON.stringify(audit)).not.toContain("private-target")
  })

  test("prioritizes unavailable when success or denied self-audit cannot append", async () => {
    const success = await createTestDb()
    await failSelfAudit(success.db)
    const successResponse = await request(success.db, "/audit-events", await token(1))
    expect(successResponse.status).toBe(503)
    expect(await successResponse.json()).toEqual({
      error: "audit events are unavailable",
      code: "audit_unavailable",
    })

    const denied = await createTestDb()
    await failSelfAudit(denied.db)
    const deniedResponse = await request(
      denied.db,
      "/audit-events?direction=private",
      await token(4),
    )
    expect(deniedResponse.status).toBe(503)
    expect(await deniedResponse.json()).toMatchObject({ code: "audit_unavailable" })
  })

  test("does not consult an invalid audit clock for authorized malformed input", async () => {
    const { db } = await createTestDb()
    const authorizedMalformed = await requestWithContext({
      db,
      jwtSecret,
      path: "/audit-events?unknown=1",
      token: await token(1),
      now: "not-a-date",
    })
    expect(authorizedMalformed.status).toBe(400)
    expect(await authorizedMalformed.json()).toMatchObject({ code: "audit_invalid_query" })

    const success = await requestWithContext({
      db,
      jwtSecret,
      path: "/audit-events",
      token: await token(1),
      now: "not-a-date",
    })
    expect(success.status).toBe(503)
    expect(await success.json()).toMatchObject({ code: "audit_unavailable" })

    const denied = await requestWithContext({
      db,
      jwtSecret,
      path: "/audit-events?unknown=private",
      token: await token(4),
      now: "not-a-date",
    })
    expect(denied.status).toBe(503)
    expect(await denied.json()).toMatchObject({ code: "audit_unavailable" })
  })

  test("sets no-store on a handled unanticipated 500 before route execution", async () => {
    const brokenBindings: Bindings = {
      get DB(): D1Database {
        throw new Error("database binding unavailable")
      },
      JWT_SECRET: jwtSecret,
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: now,
    }

    const response = await app.request("/audit-events", {}, brokenBindings)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "internal server error" })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  test("sets no-store on success, errors, rate limiting and CORS preflight", async () => {
    const { db } = await createTestDb()
    const requests = [
      await request(db, "/audit-events", await token(1)),
      await request(db, "/audit-events?unknown=1", await token(1)),
      await request(db, "/audit-events", null),
      await request(db, "/audit-events", await token(4)),
    ]
    await failSelfAudit(db)
    requests.push(await request(db, "/audit-events", await token(1)))

    const bindings: Bindings = {
      DB: db,
      JWT_SECRET: jwtSecret,
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: now,
      API_RATE_LIMITER: {
        limit: () => Promise.resolve({ success: false }),
      } as RateLimit,
    }
    requests.push(await app.request("/audit-events", {}, bindings))
    requests.push(
      await app.request(
        "/audit-events",
        {
          method: "OPTIONS",
          headers: {
            Origin: "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
          },
        },
        bindings,
      ),
    )

    expect(requests.map((response) => response.status)).toEqual([200, 400, 401, 403, 503, 429, 204])
    for (const response of requests) {
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    }
    expect(requests.at(-1)?.headers.get("Access-Control-Expose-Headers")).toContain(
      "Content-Disposition",
    )
  })
})
