import { afterEach, describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createIdentityTestKey } from "@/lib/auth/test/create-identity-test-key"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createIdentityToken } from "@/lib/auth/test/create-identity-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"

const jwtSecret = "cli-callback-route-jwt-secret"
const identityKey = await createIdentityTestKey()
const wrongIdentityKey = await createIdentityTestKey("wrong-key")
const identityIssuer = "https://identity-provider.example/"
const apiOrigin = "https://api.example.com"
const now = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600
const nowEpochMilliseconds = nowEpoch * 1_000
// audience は callback URL の origin（ブローカーは origin だけを aud に入れる）。
const callbackAudience = "https://api.example.com"
const codeVerifier = "a".repeat(43)
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
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

/** GET /auth/cli/login が発行するはずの one-time state を直接 seed する。 */
async function seedCliLoginState(
  db: D1Database,
  state: string,
  port: number,
  cliState: string,
  verifier: string = codeVerifier,
  expiresAt: number = nowEpochMilliseconds + 600_000,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO system_cli_login_states
         (state, port, cli_state, code_verifier, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(state, port, cliState, verifier, nowEpochMilliseconds, expiresAt)
    .run()
}

async function seedExternalIdentity(
  db: D1Database,
  accountId: number,
  subject: string,
  email: string,
): Promise<void> {
  const identityId = `oidc:${subject}`
  await db.batch([
    db
      .prepare(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES (?1, ?2, 'oidc', ?3, ?4, ?4, NULL)`,
      )
      .bind(identityId, String(accountId), subject, nowEpochMilliseconds),
    db
      .prepare(
        `INSERT INTO system_identity_profiles
           (identity_id, email, email_verified, last_used_at, updated_at)
         VALUES (?1, ?2, 1, NULL, ?3)`,
      )
      .bind(identityId, email, nowEpochMilliseconds),
  ])
}

function getCliCallback(db: D1Database, query: string): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: `/auth/cli/callback${query}`,
    token: null,
    method: "GET",
    now,
    identityJwks: identityKey.jwks,
    identityIssuer,
    apiOrigin,
  })
}

function mockIdentityExchange(token: string): void {
  const fetchIdentityToken = async () =>
    new Response(JSON.stringify({ id_token: token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  fetchIdentityToken.preconnect = originalFetch.preconnect
  globalThis.fetch = fetchIdentityToken
}

async function auditRows(
  db: D1Database,
): Promise<Array<{ action: string; reason_code: string | null }>> {
  return (
    await db
      .prepare("SELECT action, reason_code FROM audit_events ORDER BY id")
      .all<{ action: string; reason_code: string | null }>()
  ).results
}

describe("GET /auth/cli/callback", () => {
  test("consumes the state, resolves the account, and redirects to the loopback with a one-time code (no session issued yet)", async () => {
    const db = await createTestDb()
    await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
    await seedCliLoginState(db, "broker-state-0001", 51820, "cli-opaque-state-1")

    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      jti: "cli-callback-jti-1",
      issuer: identityIssuer,
      audience: callbackAudience,
    })
    mockIdentityExchange(token)

    const response = await getCliCallback(db, "?code=broker-code-1&state=broker-state-0001")

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
      .prepare("SELECT state FROM system_cli_login_states WHERE state = 'broker-state-0001'")
      .first()
    expect(stateRow).toBeNull()

    // code は解決済み account id だけを保持し、トークンは一切保存しない。
    const codeRow = await db
      .prepare("SELECT code_hash, account_id FROM system_cli_login_codes")
      .first<{ code_hash: string; account_id: string }>()
    expect(codeRow).toEqual({ code_hash: codeRow?.code_hash ?? "", account_id: "1" })
    const persisted = JSON.stringify(codeRow)
    expect(persisted).not.toContain(code)

    // セッション発行（ログイン成功の監査）はまだ行われていない。POST /auth/cli/token が行う。
    expect(await auditRows(db)).toEqual([])
  })

  // one-time code tableにtoken本文を保存しない契約を固定する。
  test("never persists access/refresh tokens in system_cli_login_codes", async () => {
    const db = await createTestDb()
    await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
    await seedCliLoginState(db, "broker-state-no-token-storage", 51828, "cli-opaque-state-no-token")

    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      jti: "cli-callback-jti-no-token-storage",
      issuer: identityIssuer,
      audience: callbackAudience,
    })
    mockIdentityExchange(token)

    const response = await getCliCallback(
      db,
      "?code=broker-code-no-token&state=broker-state-no-token-storage",
    )
    expect(response.status).toBe(302)

    // テーブルの列自体にトークン用カラムが存在しない。
    const columns = (
      await db.prepare("PRAGMA table_info(system_cli_login_codes)").all<{ name: string }>()
    ).results.map((column) => column.name)
    expect(columns.sort()).toEqual(["account_id", "code_hash", "created_at", "expires_at"])
    expect(columns).not.toContain("access_token")
    expect(columns).not.toContain("refresh_token")

    // 行の中身にも JWT らしき文字列（access token は "." 区切りの3セグメント JWT）は含まれない。
    const rows = await db.prepare("SELECT * FROM system_cli_login_codes").all()
    const persisted = JSON.stringify(rows.results)
    expect(persisted).not.toMatch(/^.*[\w-]+\.[\w-]+\.[\w-]+.*$/)
  })

  test("auto-provisions a new employee when no identity matches the subject", async () => {
    const db = createD1TestDatabase(loadSchema())
    await seedCliLoginState(db, "broker-state-provision", 51821, "cli-opaque-state-provision")

    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "cli-new-subject",
      email: "you+clinew@example.com",
      name: "CLI New Hire",
      jti: "cli-callback-jti-provision",
      issuer: identityIssuer,
      audience: callbackAudience,
    })
    mockIdentityExchange(token)

    const response = await getCliCallback(
      db,
      "?code=broker-code-provision&state=broker-state-provision",
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
      .prepare(
        "SELECT provider, subject FROM system_identity_bindings WHERE subject = 'cli-new-subject'",
      )
      .first<{ provider: string; subject: string }>()
    expect(identity).toEqual({ provider: "oidc", subject: "cli-new-subject" })

    // プロビジョニング監査のみ記録される。ログイン成功の監査は POST /auth/cli/token に移った。
    expect(await auditRows(db)).toEqual([{ action: "iam.identity.provisioned", reason_code: null }])
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

    const token = await createIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      issuer: identityIssuer,
      audience: callbackAudience,
      keyId: wrongIdentityKey.keyId,
    })
    mockIdentityExchange(token)

    const response = await getCliCallback(
      db,
      "?code=broker-code-bad-token&state=broker-state-bad-token",
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

    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      issuer: identityIssuer,
      audience: "https://some-other-app.example/",
    })
    mockIdentityExchange(token)

    const response = await getCliCallback(
      db,
      "?code=broker-code-bad-aud&state=broker-state-bad-aud",
    )

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(url.searchParams.get("error")).toBe("invalid_token")
  })

  test("returns 401 when the state is missing, unknown, or already consumed", async () => {
    const db = await createTestDb()

    const missing = await getCliCallback(db, "?code=whatever")
    expect(missing.status).toBe(401)

    const unknown = await getCliCallback(db, "?code=whatever&state=never-issued")
    expect(unknown.status).toBe(401)

    await seedCliLoginState(db, "broker-state-reuse", 51825, "cli-opaque-state-reuse")
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      issuer: identityIssuer,
      audience: callbackAudience,
      jti: "cli-callback-jti-reuse",
    })
    mockIdentityExchange(token)
    await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
    const first = await getCliCallback(db, "?code=broker-code-reuse&state=broker-state-reuse")
    expect(first.status).toBe(302)

    const second = await getCliCallback(db, "?code=broker-code-reuse&state=broker-state-reuse")
    expect(second.status).toBe(401)
  })

  test("denies the login and does not issue a code when the audit write itself fails", async () => {
    const db = await createTestDb()
    await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
    await seedCliLoginState(db, "broker-state-audit-down", 51827, "cli-opaque-state-audit-down")

    // audit_logs への INSERT を強制的に失敗させる（監査書き込みが不可能な状態を模す）。
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    // 無効な token による invalid_token 拒否パス（denyAndLoopback 経由）で検証する。
    const token = await createIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      issuer: identityIssuer,
      audience: callbackAudience,
      keyId: wrongIdentityKey.keyId,
    })
    mockIdentityExchange(token)

    const response = await getCliCallback(
      db,
      "?code=broker-code-audit-down&state=broker-state-audit-down",
    )

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(`${url.origin}${url.pathname}`).toBe("http://127.0.0.1:51827/callback")
    expect(url.searchParams.get("state")).toBe("cli-opaque-state-audit-down")
    // reasonCode(invalid_token) ではなく audit_unavailable が載る。ログインは拒否されたまま。
    expect(url.searchParams.get("error")).toBe("audit_unavailable")
    expect(url.searchParams.get("code")).toBeNull()

    // one-time code は発行されていない。
    const codeRows = await db
      .prepare("SELECT COUNT(*) AS count FROM system_cli_login_codes")
      .first<number>("count")
    expect(codeRows).toBe(0)

    // 監査行自体は書き込みに失敗しているので残らない。
    expect(await auditRows(db)).toEqual([])
  })

  test("rejects when cli login is not configured (missing IDENTITY_JWKS/API_ORIGIN)", async () => {
    const db = await createTestDb()
    await seedCliLoginState(db, "broker-state-unconfigured", 51826, "cli-opaque-state-unconfigured")

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/auth/cli/callback?code=whatever&state=broker-state-unconfigured",
      token: null,
      method: "GET",
      now,
      // identityJwks / apiOrigin を渡さない = 未設定。
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(url.searchParams.get("error")).toBe("cli_login_not_configured")
  })
})
