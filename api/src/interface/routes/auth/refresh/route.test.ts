import { describe, expect, test } from "bun:test"
import { app } from "@/api/app"
import type { Bindings } from "@/env"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { hashAuditIdentifier } from "@/lib/audit/hash-audit-identifier"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"
import { z } from "zod"

const jwtSecret = "auth-refresh-route-test-secret"
const auditHmacSecret = "request-with-context-audit-hmac-secret"
const nowEpoch = 1_767_225_600
const familyId = "route-refresh-family"

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

const refreshResponseSchema = z.strictObject({
  access_token: z.string(),
  refresh_token: z.string(),
})

type Scenario =
  | "active"
  | "missing"
  | "expired"
  | "revoked"
  | "inactive_account"
  | "version_mismatch"
  | "missing_employee"
  | "retired_employee"

async function createScenario(scenario: Scenario): Promise<{
  db: D1Database
  refreshToken: string
}> {
  const db = createD1TestDatabase(loadSchema())
  const refreshToken = `route-${scenario}-refresh-token`
  if (scenario !== "missing_employee") {
    await db
      .prepare(
        `INSERT INTO employees (id, code, name, status)
         VALUES (1, 'E001', 'Test Worker', ?1)`,
      )
      .bind(scenario === "retired_employee" ? "retired" : "active")
      .run()
  }
  await db
    .prepare(
      `INSERT INTO accounts
         (id, status, token_version, created_at, updated_at)
       VALUES (1, ?1, ?2, ?3, ?3)`,
    )
    .bind(
      scenario === "inactive_account" ? "suspended" : "active",
      scenario === "version_mismatch" ? 1 : 0,
      nowEpoch - 100,
    )
    .run()
  if (scenario !== "missing_employee") {
    await db
      .prepare("INSERT INTO account_employee_links (account_id, employee_id) VALUES (1, 1)")
      .run()
  }

  if (scenario !== "missing") {
    await db
      .prepare(
        `INSERT INTO refresh_tokens
           (id, account_id, token_hash, family_id, token_version, expires_at,
            revoked_at, user_agent, created_at)
         VALUES (1, 1, ?1, ?2, 0, ?3, ?4, 'fixture-agent', ?5)`,
      )
      .bind(
        await refreshTokenHash(refreshToken),
        familyId,
        scenario === "expired" ? nowEpoch : nowEpoch + 3_600,
        scenario === "revoked" ? nowEpoch - 10 : null,
        nowEpoch - 100,
      )
      .run()
  }
  if (scenario === "revoked") {
    await db
      .prepare(
        `INSERT INTO refresh_tokens
           (id, account_id, token_hash, family_id, token_version, expires_at,
            revoked_at, user_agent, created_at)
         VALUES (2, 1, ?1, ?2, 0, ?3, NULL, 'descendant-agent', ?4)`,
      )
      .bind(
        await refreshTokenHash("route-active-descendant"),
        familyId,
        nowEpoch + 3_600,
        nowEpoch - 5,
      )
      .run()
  }

  return { db, refreshToken }
}

function postRefresh(
  db: D1Database,
  refreshToken: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/auth/refresh",
    token: null,
    method: "POST",
    body: { refresh_token: refreshToken },
    headers,
  })
}

function postRefreshWithAuditSecret(
  db: D1Database,
  refreshToken: string,
  auditSecret: string | undefined,
): Promise<Response> {
  const bindings: Partial<Bindings> = {
    DB: db,
    JWT_SECRET: jwtSecret,
    NOW: "2026-01-01T00:00:00.000Z",
  }
  if (auditSecret !== undefined) bindings.AUDIT_HMAC_SECRET = auditSecret

  return Promise.resolve(
    app.request(
      "/auth/refresh",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      bindings as Bindings,
    ),
  )
}

function postMalformedRefresh(db: D1Database): Promise<Response> {
  return Promise.resolve(
    app.request(
      "/auth/refresh",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"refresh_token":',
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

async function activeFamilyCount(db: D1Database): Promise<number | null> {
  return db
    .prepare(
      "SELECT COUNT(*) AS count FROM refresh_tokens WHERE family_id = ?1 AND revoked_at IS NULL",
    )
    .bind(familyId)
    .first<number>("count")
}

async function auditCount(db: D1Database): Promise<number | null> {
  return db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count")
}

describe("POST /auth/refresh", () => {
  test("returns the same safe 503 before every denial branch when audit HMAC is absent or blank", async () => {
    const scenarios: Scenario[] = ["missing", "expired", "revoked", "inactive_account"]
    const secretStates = [
      { name: "absent", value: undefined },
      { name: "blank", value: "   " },
    ] as const
    const responses: Array<{
      scenario: Scenario
      secret: string
      status: number
      body: unknown
    }> = []

    for (const scenario of scenarios) {
      for (const secret of secretStates) {
        const { db, refreshToken } = await createScenario(scenario)
        const activeBefore = await activeFamilyCount(db)
        const response = await postRefreshWithAuditSecret(db, refreshToken, secret.value)
        const body = await response.json()

        responses.push({
          scenario,
          secret: secret.name,
          status: response.status,
          body,
        })
        expect(body).not.toHaveProperty("access_token")
        expect(body).not.toHaveProperty("refresh_token")
        expect(await auditCount(db)).toBe(0)
        expect(await activeFamilyCount(db)).toBe(activeBefore)
      }
    }

    expect(responses).toEqual(
      scenarios.flatMap((scenario) =>
        secretStates.map((secret) => ({
          scenario,
          secret: secret.name,
          status: 503,
          body: {
            error: "invalid or expired refresh token",
            code: "audit_unavailable",
          },
        })),
      ),
    )
  })

  test("returns only tokens and records the exact successful refresh event", async () => {
    const { db, refreshToken } = await createScenario("active")
    const incomingRequestId = "external-refresh-request-41"
    const response = await postRefresh(db, refreshToken, {
      "CF-Connecting-IP": "198.51.100.42",
      "X-Forwarded-For": "203.0.113.42",
      "X-Open-Karte-Client": "web",
      "X-Request-ID": incomingRequestId,
      Authorization: "Bearer refresh-authorization-private",
      Cookie: "refresh_cookie=private",
      "User-Agent": "refresh-route-private-agent",
    })

    expect(response.status).toBe(200)
    const body = refreshResponseSchema.parse(await response.json())
    expect(Object.keys(body).sort()).toEqual(["access_token", "refresh_token"])
    const internalRequestId = response.headers.get("X-Request-ID")
    expect(internalRequestId).not.toBe(incomingRequestId)
    const expectedFamilyHash = await hashAuditIdentifier(
      `refresh-family:${familyId}`,
      auditHmacSecret,
    )
    expect(
      await db
        .prepare(
          `SELECT actor_account_id, actor_employee_id, action, target_type, target_id,
                  outcome, reason_code, authorization_json, before_json, after_json,
                  metadata_json, client_ip, client_name,
                  request_id, created_at
           FROM company_audit_events`,
        )
        .first<Record<string, unknown>>(),
    ).toEqual({
      actor_account_id: 1,
      actor_employee_id: 1,
      action: "auth.session.refreshed",
      target_type: "account",
      target_id: "1",
      outcome: "succeeded",
      reason_code: null,
      authorization_json: null,
      before_json: null,
      after_json: null,
      metadata_json: `{"family_id_hash":"${expectedFamilyHash}"}`,
      client_ip: "198.51.100.42",
      client_name: "web",
      request_id: internalRequestId,
      created_at: nowEpoch,
    })
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM audit_batch_decisions")
        .first<number>("count"),
    ).toBe(0)

    const persisted = JSON.stringify(await db.prepare("SELECT * FROM company_audit_events").all())
    for (const secret of [
      refreshToken,
      await refreshTokenHash(refreshToken),
      familyId,
      body.access_token,
      body.refresh_token,
      "refresh-authorization-private",
      "refresh_cookie",
      "refresh-route-private-agent",
      "203.0.113.42",
    ]) {
      expect(persisted).not.toContain(secret)
    }
  })

  test("returns one identical 401 contract while recording target knowledge internally", async () => {
    const scenarios: Scenario[] = [
      "missing",
      "expired",
      "revoked",
      "inactive_account",
      "version_mismatch",
      "missing_employee",
      "retired_employee",
    ]
    const responses: Array<{ status: number; body: unknown }> = []
    const expectedFamilyHash = await hashAuditIdentifier(
      `refresh-family:${familyId}`,
      auditHmacSecret,
    )

    for (const scenario of scenarios) {
      const { db, refreshToken } = await createScenario(scenario)
      const incomingRequestId = `external-refresh-denial-${scenario}`
      const response = await postRefresh(db, refreshToken, {
        "CF-Connecting-IP": "198.51.100.44",
        "X-Forwarded-For": "203.0.113.45",
        "X-Open-Karte-Client": "cli",
        "X-Request-ID": incomingRequestId,
        "User-Agent": "refresh-denial-private-agent",
      })
      responses.push({ status: response.status, body: await response.json() })
      const internalRequestId = response.headers.get("X-Request-ID")
      expect(internalRequestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
      expect(internalRequestId).not.toBe(incomingRequestId)
      const row = await db.prepare("SELECT * FROM company_audit_events").first<AuditDatabaseRow>()
      if (internalRequestId === null) throw new Error("internal request ID is missing")
      if (row === null) throw new Error("audit event is missing")
      expect(row.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
      expect(row).toEqual({
        id: 1,
        event_id: row.event_id,
        request_id: internalRequestId,
        actor_account_id: null,
        actor_employee_id: null,
        action: scenario === "revoked" ? "auth.session.reuse_detected" : "auth.session.refreshed",
        target_type: scenario === "missing" ? "session" : "account",
        target_id: scenario === "missing" ? null : "1",
        outcome: "denied",
        reason_code: scenario === "revoked" ? "refresh_token_reuse" : "invalid_token",
        authorization_json: null,
        before_json: null,
        after_json: null,
        metadata_json: scenario === "missing" ? null : `{"family_id_hash":"${expectedFamilyHash}"}`,
        client_ip: "198.51.100.44",
        client_name: "cli",
        created_at: nowEpoch,
      })
    }

    expect(responses).toEqual(
      scenarios.map(() => ({
        status: 401,
        body: { error: "invalid or expired refresh token" },
      })),
    )
  })

  test("returns identical credential-safe 503 responses for every denial audit failure", async () => {
    const scenarios: Scenario[] = [
      "missing",
      "expired",
      "revoked",
      "inactive_account",
      "version_mismatch",
      "missing_employee",
      "retired_employee",
    ]
    const responses: Array<{ status: number; body: unknown }> = []

    for (const scenario of scenarios) {
      const { db, refreshToken } = await createScenario(scenario)
      const activeBefore = await activeFamilyCount(db)
      await db.exec(`
        CREATE TRIGGER reject_test_audit_insert
        BEFORE INSERT ON audit_events
        BEGIN
          SELECT RAISE(ABORT, 'forced audit insert failure');
        END;
      `)
      const response = await postRefresh(db, refreshToken)
      const body = await response.json()
      responses.push({ status: response.status, body })
      expect(body).not.toHaveProperty("access_token")
      expect(body).not.toHaveProperty("refresh_token")
      expect(await auditCount(db)).toBe(0)
      expect(await activeFamilyCount(db)).toBe(activeBefore)
    }

    expect(responses).toEqual(
      scenarios.map(() => ({
        status: 503,
        body: { error: "invalid or expired refresh token", code: "audit_unavailable" },
      })),
    )
  })

  test("rolls a successful rotation back and returns no token keys when audit fails", async () => {
    const { db, refreshToken } = await createScenario("active")
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const response = await postRefresh(db, refreshToken)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      error: "invalid or expired refresh token",
      code: "audit_unavailable",
    })
    expect(body).not.toHaveProperty("access_token")
    expect(body).not.toHaveProperty("refresh_token")
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM refresh_tokens").first<number>("count"),
    ).toBe(1)
    expect(await auditCount(db)).toBe(0)
  })

  test("rolls reuse revocation back on audit failure and succeeds on the same retry", async () => {
    const { db, refreshToken } = await createScenario("revoked")
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const failed = await postRefresh(db, refreshToken)
    expect(failed.status).toBe(503)
    expect(await activeFamilyCount(db)).toBe(1)
    expect(await auditCount(db)).toBe(0)

    await db.exec("DROP TRIGGER reject_test_audit_insert")
    const retried = await postRefresh(db, refreshToken)

    expect(retried.status).toBe(401)
    expect(await activeFamilyCount(db)).toBe(0)
    expect(await db.prepare("SELECT action FROM audit_events").first<string>("action")).toBe(
      "auth.session.reuse_detected",
    )
  })

  test("does not audit validator failures", async () => {
    const { db } = await createScenario("active")

    for (const body of [{}, { refresh_token: "x".repeat(201) }]) {
      const response = await requestWithContext({
        db,
        jwtSecret,
        path: "/auth/refresh",
        token: null,
        method: "POST",
        body,
      })
      expect(response.status).toBe(400)
    }
    expect((await postMalformedRefresh(db)).status).toBe(400)

    expect(await auditCount(db)).toBe(0)
  })
})
