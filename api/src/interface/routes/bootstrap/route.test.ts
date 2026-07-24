import { describe, expect, test } from "bun:test"
import { app } from "@/app"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { z } from "zod"

const jwtSecret = "bootstrap-route-test-secret"
const auditHmacSecret = "request-with-context-audit-hmac-secret"
const bootstrapToken = "bootstrap-route-test-token"
const nowIso = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600

const bootstrapResponseSchema = z.strictObject({
  account_id: z.number(),
  employee_id: z.number(),
  email: z.string(),
})

function createTestDb(): D1Database {
  return createD1TestDatabase(loadSchema())
}

type BootstrapBindings = {
  DB: D1Database
  JWT_SECRET: string
  AUDIT_HMAC_SECRET: string
  NOW: string
  BOOTSTRAP_TOKEN?: string
}

function postBootstrap(
  db: D1Database,
  body: unknown,
  options?: { token?: string; withToken?: boolean },
): Promise<Response> {
  const bindings: BootstrapBindings = {
    DB: db,
    JWT_SECRET: jwtSecret,
    AUDIT_HMAC_SECRET: auditHmacSecret,
    NOW: nowIso,
  }

  const withToken = options?.withToken ?? true

  if (withToken) {
    bindings.BOOTSTRAP_TOKEN = options?.token ?? bootstrapToken
  }

  return Promise.resolve(
    app.request(
      "/bootstrap",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      bindings,
    ),
  )
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    token: bootstrapToken,
    email: "root@example.com",
    password: "Passw0rd",
    name: "Root Admin",
    ...overrides,
  }
}

function postLogin(db: D1Database, body: unknown): Promise<Response> {
  return Promise.resolve(
    app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      {
        DB: db,
        JWT_SECRET: jwtSecret,
        AUDIT_HMAC_SECRET: auditHmacSecret,
        COMPANY_TIME_ZONE: "Asia/Tokyo",
        NOW: nowIso,
      },
    ),
  )
}

async function tableCount(db: D1Database, table: string): Promise<number | null> {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<number>("count")
}

describe("POST /bootstrap", () => {
  test("returns 404 when BOOTSTRAP_TOKEN is not configured", async () => {
    const db = createTestDb()

    const response = await postBootstrap(db, validBody(), { withToken: false })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "not_found" })
    expect(await tableCount(db, "accounts")).toBe(0)
  })

  test("returns 404 for an invalid body when BOOTSTRAP_TOKEN is not configured", async () => {
    const db = createTestDb()

    const response = await postBootstrap(db, { token: 1 }, { withToken: false })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "not_found" })
  })

  test("returns 401 when the token does not match", async () => {
    const db = createTestDb()

    const response = await postBootstrap(db, validBody({ token: "wrong-token" }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "unauthorized" })
    expect(await tableCount(db, "accounts")).toBe(0)
  })

  test("returns 409 when an account already exists", async () => {
    const db = createTestDb()
    await db
      .prepare(
        "INSERT INTO accounts (employee_id, status, token_version, created_at, updated_at) VALUES (NULL, 'active', 0, 0, 0)",
      )
      .run()

    const response = await postBootstrap(db, validBody())

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "already_initialized" })
    expect(await tableCount(db, "accounts")).toBe(1)
  })

  test("creates the four IAM rows, records an audit event, and allows login", async () => {
    const db = createTestDb()

    const response = await postBootstrap(db, validBody())

    expect(response.status).toBe(201)
    const body = bootstrapResponseSchema.parse(await response.json())
    expect(Object.keys(body).sort()).toEqual(["account_id", "email", "employee_id"])
    expect(body.email).toBe("root@example.com")

    const employee = await db
      .prepare("SELECT code, name, status FROM employees WHERE id = ?1")
      .bind(body.employee_id)
      .first<{ code: string; name: string; status: string }>()
    expect(employee).toEqual({ code: "E001", name: "Root Admin", status: "active" })

    const account = await db
      .prepare("SELECT employee_id, status, token_version FROM accounts WHERE id = ?1")
      .bind(body.account_id)
      .first<{ employee_id: number; status: string; token_version: number }>()
    expect(account).toEqual({
      employee_id: body.employee_id,
      status: "active",
      token_version: 0,
    })

    const identity = await db
      .prepare(
        "SELECT provider, subject, email, email_verified FROM identities WHERE account_id = ?1",
      )
      .bind(body.account_id)
      .first<{ provider: string; subject: string; email: string; email_verified: number }>()
    expect(identity).toEqual({
      provider: "password",
      subject: "root@example.com",
      email: "root@example.com",
      email_verified: 1,
    })

    const roleRow = await db
      .prepare(
        `SELECT r.key AS role_key, r.is_system AS is_system
         FROM account_roles ar
         JOIN roles r ON r.id = ar.role_id
         WHERE ar.account_id = ?1`,
      )
      .bind(body.account_id)
      .first<{ role_key: string; is_system: number }>()
    expect(roleRow).toEqual({ role_key: "root", is_system: 1 })

    const audit = await db
      .prepare(
        "SELECT action, target_type, target_id, outcome, actor_account_id, created_at FROM audit_logs",
      )
      .first<Record<string, unknown>>()
    expect(audit).toEqual({
      action: "auth.bootstrap.completed",
      target_type: "account",
      target_id: null,
      outcome: "succeeded",
      actor_account_id: null,
      created_at: nowEpoch,
    })

    const persisted = JSON.stringify(await db.prepare("SELECT * FROM audit_logs").all())
    expect(persisted).not.toContain("root@example.com")
    expect(persisted).not.toContain("Passw0rd")

    const loginResponse = await postLogin(db, {
      email: "root@example.com",
      password: "Passw0rd",
    })
    expect(loginResponse.status).toBe(200)
    const loginBody = z
      .object({ access_token: z.string(), refresh_token: z.string() })
      .parse(await loginResponse.json())
    expect(loginBody.access_token.length).toBeGreaterThan(0)
  })

  test("returns 409 on a second run after a successful bootstrap", async () => {
    const db = createTestDb()

    const first = await postBootstrap(db, validBody())
    expect(first.status).toBe(201)

    const second = await postBootstrap(db, validBody())
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ error: "already_initialized" })

    expect(await tableCount(db, "accounts")).toBe(1)
    expect(await tableCount(db, "employees")).toBe(1)
    expect(await tableCount(db, "audit_logs")).toBe(1)
  })

  test("rejects a password that fails the complexity policy", async () => {
    const db = createTestDb()

    const response = await postBootstrap(db, validBody({ password: "password" }))

    expect(response.status).toBe(400)
    expect(await tableCount(db, "accounts")).toBe(0)
  })
})
