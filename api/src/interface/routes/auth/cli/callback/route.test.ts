import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createIdentityToken } from "@/interface/test-helpers/create-identity-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"

const jwtSecret = "cli-callback-route-jwt-secret"
const identityJwtSecret = "cli-callback-route-identity-secret"
const identityIssuer = "https://identity-provider.example/"
const apiOrigin = "https://api.example.com"
const now = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600
// audience は callback URL 自身の origin（GET /auth/cli/callback が検証に使う値）。
const callbackAudience = "https://api.example.com/auth/cli/callback"

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

/** GET /auth/cli/login が発行するはずの one-time state を直接 seed する。 */
async function seedCliLoginState(
  db: D1Database,
  state: string,
  port: number,
  cliState: string,
  expiresAt: number = nowEpoch + 600,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO cli_login_states (state, port, cli_state, expires_at) VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(state, port, cliState, expiresAt)
    .run()
}

async function seedExternalIdentity(
  db: D1Database,
  accountId: number,
  subject: string,
  email: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO identities (account_id, provider, subject, secret, email, email_verified, created_at)
       VALUES (?1, 'oidc', ?2, NULL, ?3, 1, 0)`,
    )
    .bind(accountId, subject, email)
    .run()
}

function getCliCallback(db: D1Database, query: string): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: `/auth/cli/callback${query}`,
    token: null,
    method: "GET",
    now,
    identityJwtSecret,
    identityIssuer,
    apiOrigin,
  })
}

async function auditRows(
  db: D1Database,
): Promise<Array<{ action: string; reason_code: string | null }>> {
  return (
    await db
      .prepare("SELECT action, reason_code FROM audit_logs ORDER BY id")
      .all<{ action: string; reason_code: string | null }>()
  ).results
}

describe("GET /auth/cli/callback", () => {
  test("consumes the state, issues a session, and redirects to the loopback with a one-time code", async () => {
    const db = await createTestDb()
    await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
    await seedCliLoginState(db, "broker-state-1", 51820, "cli-opaque-state-1")

    const token = await createIdentityToken(identityJwtSecret, nowEpoch, {
      sub: "external-subject-1",
      jti: "cli-callback-jti-1",
      issuer: identityIssuer,
      audience: callbackAudience,
    })

    const response = await getCliCallback(
      db,
      `?token=${encodeURIComponent(token)}&state=broker-state-1`,
    )

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    expect(location).not.toBeNull()
    if (location === null) throw new Error("missing Location header")

    const url = new URL(location)
    expect(`${url.origin}${url.pathname}`).toBe("http://127.0.0.1:51820/callback")
    expect(url.searchParams.get("state")).toBe("cli-opaque-state-1")
    const code = url.searchParams.get("code")
    expect(code).not.toBeNull()
    expect(url.searchParams.get("error")).toBeNull()

    // state は 1 回で消費され、テーブルから消える。
    const stateRow = await db
      .prepare("SELECT state FROM cli_login_states WHERE state = 'broker-state-1'")
      .first()
    expect(stateRow).toBeNull()

    // code はハッシュとして保存され、生の code はテーブルに残らない。
    const codeRows = await db.prepare("SELECT code_hash FROM cli_login_codes").all()
    expect(codeRows.results.length).toBe(1)
    const persisted = JSON.stringify(codeRows.results)
    expect(persisted).not.toContain(code)

    expect(await auditRows(db)).toEqual([
      { action: "auth.session.cli_login_succeeded", reason_code: null },
    ])
  })

  test("auto-provisions a new employee when no identity matches the subject", async () => {
    const db = createD1TestDatabase(loadSchema())
    await seedCliLoginState(db, "broker-state-provision", 51821, "cli-opaque-state-provision")

    const token = await createIdentityToken(identityJwtSecret, nowEpoch, {
      sub: "cli-new-subject",
      email: "you+clinew@example.com",
      name: "CLI New Hire",
      jti: "cli-callback-jti-provision",
      issuer: identityIssuer,
      audience: callbackAudience,
    })

    const response = await getCliCallback(
      db,
      `?token=${encodeURIComponent(token)}&state=broker-state-provision`,
    )

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(url.searchParams.get("code")).not.toBeNull()

    const employee = await db
      .prepare("SELECT id, code FROM employees WHERE name = 'CLI New Hire'")
      .first<{ id: number; code: string | null }>()
    expect(employee?.code).toBeNull()

    const identity = await db
      .prepare("SELECT provider, subject FROM identities WHERE subject = 'cli-new-subject'")
      .first<{ provider: string; subject: string }>()
    expect(identity).toEqual({ provider: "oidc", subject: "cli-new-subject" })

    expect(await auditRows(db)).toEqual([
      { action: "iam.identity.provisioned", reason_code: null },
      { action: "auth.session.cli_login_succeeded", reason_code: null },
    ])
  })

  test("redirects to the loopback with error=<broker error> when the broker reports one", async () => {
    const db = await createTestDb()
    await seedCliLoginState(db, "broker-state-error", 51822, "cli-opaque-state-error")

    const response = await getCliCallback(db, "?state=broker-state-error&error=access_denied")

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(`${url.origin}${url.pathname}`).toBe("http://127.0.0.1:51822/callback")
    expect(url.searchParams.get("state")).toBe("cli-opaque-state-error")
    expect(url.searchParams.get("error")).toBe("access_denied")
  })

  test("redirects to the loopback with error=invalid_token when the identity token is invalid", async () => {
    const db = await createTestDb()
    await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
    await seedCliLoginState(db, "broker-state-bad-token", 51823, "cli-opaque-state-bad-token")

    const token = await createIdentityToken("wrong-secret", nowEpoch, {
      sub: "external-subject-1",
      issuer: identityIssuer,
      audience: callbackAudience,
    })

    const response = await getCliCallback(
      db,
      `?token=${encodeURIComponent(token)}&state=broker-state-bad-token`,
    )

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(url.searchParams.get("error")).toBe("invalid_token")
    expect((await auditRows(db))[0]).toEqual({
      action: "auth.session.cli_login_denied",
      reason_code: "invalid_token",
    })
  })

  test("rejects an audience that does not match the callback origin", async () => {
    const db = await createTestDb()
    await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
    await seedCliLoginState(db, "broker-state-bad-aud", 51824, "cli-opaque-state-bad-aud")

    const token = await createIdentityToken(identityJwtSecret, nowEpoch, {
      sub: "external-subject-1",
      issuer: identityIssuer,
      audience: "https://some-other-app.example/",
    })

    const response = await getCliCallback(
      db,
      `?token=${encodeURIComponent(token)}&state=broker-state-bad-aud`,
    )

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(url.searchParams.get("error")).toBe("invalid_token")
  })

  test("returns 401 when the state is missing, unknown, or already consumed", async () => {
    const db = await createTestDb()

    const missing = await getCliCallback(db, "?token=whatever")
    expect(missing.status).toBe(401)

    const unknown = await getCliCallback(db, "?token=whatever&state=never-issued")
    expect(unknown.status).toBe(401)

    await seedCliLoginState(db, "broker-state-reuse", 51825, "cli-opaque-state-reuse")
    const token = await createIdentityToken(identityJwtSecret, nowEpoch, {
      sub: "external-subject-1",
      issuer: identityIssuer,
      audience: callbackAudience,
      jti: "cli-callback-jti-reuse",
    })
    await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
    const first = await getCliCallback(
      db,
      `?token=${encodeURIComponent(token)}&state=broker-state-reuse`,
    )
    expect(first.status).toBe(302)

    const second = await getCliCallback(
      db,
      `?token=${encodeURIComponent(token)}&state=broker-state-reuse`,
    )
    expect(second.status).toBe(401)
  })

  test("rejects when cli login is not configured (missing IDENTITY_JWT_SECRET/API_ORIGIN)", async () => {
    const db = await createTestDb()
    await seedCliLoginState(db, "broker-state-unconfigured", 51826, "cli-opaque-state-unconfigured")

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/auth/cli/callback?token=whatever&state=broker-state-unconfigured",
      token: null,
      method: "GET",
      now,
      // identityJwtSecret / apiOrigin を渡さない = 未設定。
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(url.searchParams.get("error")).toBe("cli_login_not_configured")
  })
})
