import { describe, expect, test } from "bun:test"
import { app } from "@/app"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { hashAuditIdentifier } from "@/lib/audit/hash-audit-identifier"
import { z } from "zod"

const jwtSecret = "auth-login-route-test-secret"
const auditHmacSecret = "request-with-context-audit-hmac-secret"
const nowEpoch = 1_767_225_600

type AuditDatabaseRow = {
  id: number
  event_id: string
  request_id: string
  actor_account_id: number | null
  actor_employee_id: number | null
  action: string
  target_type: string | null
  target_id: string | null
  outcome: string
  reason_code: string | null
  authorization_json: string | null
  before_json: string | null
  after_json: string | null
  metadata_json: string | null
  client_ip: string | null
  client_name: string
  created_at: number
}

const loginResponseSchema = z.strictObject({
  access_token: z.string(),
  refresh_token: z.string(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )
  await seedIamForEmployees(db)

  return db
}

async function postLogin(
  db: D1Database,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/auth/login",
    token: null,
    method: "POST",
    body,
    headers,
  })
}

function postMalformedLogin(db: D1Database): Promise<Response> {
  return Promise.resolve(
    app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"email":',
      },
      {
        DB: db,
        JWT_SECRET: jwtSecret,
        AUDIT_HMAC_SECRET: auditHmacSecret,
        NOW: "2026-01-01T00:00:00.000Z",
      },
    ),
  )
}

async function json(response: Response): Promise<unknown> {
  return response.json()
}

async function auditCount(db: D1Database): Promise<number | null> {
  return db.prepare("SELECT COUNT(*) AS count FROM audit_logs").first<number>("count")
}

describe("POST /auth/login", () => {
  test("returns only the public token view and records the exact success event", async () => {
    const db = await createTestDb()
    const incomingRequestId = "external-login-request-41"
    const response = await postLogin(
      db,
      { email: "you+e001@example.com", password: "password" },
      {
        "CF-Connecting-IP": "198.51.100.41",
        "X-Forwarded-For": "203.0.113.99",
        "X-Open-Karte-Client": "cli",
        "X-Request-ID": incomingRequestId,
        Authorization: "Bearer must-not-be-audited",
        Cookie: "session=must-not-be-audited",
        "User-Agent": "route-private-agent",
      },
    )

    expect(response.status).toBe(200)
    const body = loginResponseSchema.parse(await response.json())
    expect(Object.keys(body).sort()).toEqual(["access_token", "refresh_token"])
    const internalRequestId = response.headers.get("X-Request-ID")
    expect(internalRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(internalRequestId).not.toBe(incomingRequestId)
    expect(
      await db
        .prepare(
          `SELECT actor_account_id, actor_employee_id, action, target_type, target_id,
                  outcome, reason_code, authorization_json, before_json, after_json,
                  metadata_json, client_ip, client_name, request_id, created_at
           FROM audit_logs`,
        )
        .first<Record<string, unknown>>(),
    ).toEqual({
      actor_account_id: 1,
      actor_employee_id: 1,
      action: "auth.session.login_succeeded",
      target_type: "account",
      target_id: "1",
      outcome: "succeeded",
      reason_code: null,
      authorization_json: null,
      before_json: null,
      after_json: null,
      metadata_json: null,
      client_ip: "198.51.100.41",
      client_name: "cli",
      request_id: internalRequestId,
      created_at: nowEpoch,
    })

    const persisted = JSON.stringify(await db.prepare("SELECT * FROM audit_logs").all())
    for (const secret of [
      "you+e001@example.com",
      "password",
      body.access_token,
      body.refresh_token,
      "must-not-be-audited",
      "route-private-agent",
    ]) {
      expect(persisted).not.toContain(secret)
    }
  })

  test("returns identical 401 responses for wrong, unknown, inactive, and retired credentials", async () => {
    const cases = [
      { email: "you+e001@example.com", password: "wrong" },
      { email: "you+unknown@example.com", password: "password" },
      { email: "you+e002@example.com", password: "password", inactive: true },
      { email: "you+e018@example.com", password: "password" },
    ]
    const responses: Array<{ status: number; body: unknown }> = []

    for (const login of cases) {
      const db = await createTestDb()
      if (login.inactive === true) {
        await db.prepare("UPDATE accounts SET status = 'suspended' WHERE id = 2").run()
      }
      const response = await postLogin(db, login)
      responses.push({ status: response.status, body: await json(response) })
      expect(await auditCount(db)).toBe(1)
    }

    expect(responses).toEqual(
      cases.map(() => ({ status: 401, body: { error: "invalid email or password" } })),
    )
  })

  test("records a privacy-minimized denial and normalizes identifier HMAC input", async () => {
    const db = await createTestDb()
    const variants = [" YOU+E001@EXAMPLE.COM ", "you+e001@example.com"]
    const internalRequestIds: string[] = []

    for (const [index, email] of variants.entries()) {
      const incomingRequestId = `external-login-denial-${index}`
      const response = await postLogin(
        db,
        { email, password: "wrong-password" },
        {
          "CF-Connecting-IP": "198.51.100.43",
          "X-Forwarded-For": "203.0.113.44",
          "X-Open-Karte-Client": "web",
          "X-Request-ID": incomingRequestId,
          "User-Agent": "denied-private-agent",
        },
      )
      expect(response.status).toBe(401)
      const internalRequestId = response.headers.get("X-Request-ID")
      expect(internalRequestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
      expect(internalRequestId).not.toBe(incomingRequestId)
      if (internalRequestId === null) throw new Error("internal request ID is missing")
      internalRequestIds.push(internalRequestId)
    }

    const rows = (await db.prepare("SELECT * FROM audit_logs ORDER BY id").all<AuditDatabaseRow>())
      .results
    const expectedHash = await hashAuditIdentifier(variants[0], auditHmacSecret)
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/)
    for (const row of rows) {
      expect(row.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
    }
    expect(rows).toEqual(
      variants.map((_, index) => ({
        id: index + 1,
        event_id: rows[index]?.event_id,
        request_id: internalRequestIds[index],
        actor_account_id: null,
        actor_employee_id: null,
        action: "auth.session.login_denied",
        target_type: "session",
        target_id: null,
        outcome: "denied",
        reason_code: "invalid_credentials",
        authorization_json: null,
        before_json: null,
        after_json: null,
        metadata_json: `{"identifier_hash":"${expectedHash}"}`,
        client_ip: "198.51.100.43",
        client_name: "web",
        created_at: nowEpoch,
      })),
    )

    const persisted = JSON.stringify(await db.prepare("SELECT * FROM audit_logs").all())
    expect(persisted).not.toContain("you+e001@example.com")
    expect(persisted).not.toContain("wrong-password")
    expect(persisted).not.toContain("denied-private-agent")
    expect(persisted).not.toContain("203.0.113.44")
  })

  test("returns identical credential-safe 503 responses for all denial branches", async () => {
    const cases = [
      { email: "you+e001@example.com", password: "wrong" },
      { email: "you+unknown@example.com", password: "password" },
      { email: "you+e002@example.com", password: "password", inactive: true },
      { email: "you+e018@example.com", password: "password" },
    ]
    const responses: Array<{ status: number; body: unknown }> = []

    for (const login of cases) {
      const db = await createTestDb()
      if (login.inactive === true) {
        await db.prepare("UPDATE accounts SET status = 'suspended' WHERE id = 2").run()
      }
      await db.exec(`
        CREATE TRIGGER reject_test_audit_insert
        BEFORE INSERT ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'forced audit insert failure');
        END;
      `)
      const response = await postLogin(db, login)
      responses.push({ status: response.status, body: await json(response) })
      expect(await auditCount(db)).toBe(0)
    }

    expect(responses).toEqual(
      cases.map(() => ({
        status: 503,
        body: { error: "invalid email or password", code: "audit_unavailable" },
      })),
    )
  })

  test("rolls token creation back and returns no token keys when success audit fails", async () => {
    const db = await createTestDb()
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const response = await postLogin(db, {
      email: "you+e001@example.com",
      password: "password",
    })
    const body = await json(response)

    expect(response.status).toBe(503)
    expect(body).toEqual({ error: "invalid email or password", code: "audit_unavailable" })
    expect(body).not.toHaveProperty("access_token")
    expect(body).not.toHaveProperty("refresh_token")
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM refresh_tokens").first<number>("count"),
    ).toBe(0)
    expect(await auditCount(db)).toBe(0)
  })

  test("does not audit validator failures", async () => {
    const db = await createTestDb()

    for (const body of [
      { email: "you+e001@example.com" },
      { email: "x".repeat(255), password: "password" },
    ]) {
      const response = await postLogin(db, body)
      expect(response.status).toBe(400)
    }
    expect((await postMalformedLogin(db)).status).toBe(400)

    expect(await auditCount(db)).toBe(0)
  })

  test("continues to allow a leave employee", async () => {
    const db = await createTestDb()
    const response = await postLogin(db, {
      email: "you+e017@example.com",
      password: "password",
    })

    expect(response.status).toBe(200)
  })
})
