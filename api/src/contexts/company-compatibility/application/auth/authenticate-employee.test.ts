import { describe, expect, test } from "bun:test"
import { AuthenticateEmployee } from "@/contexts/company-compatibility/application/auth/authenticate-employee"
import { accessTokenService } from "@/contexts/company-compatibility/infrastructure/auth/jose-token-signer"
import { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material.service"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { UnavailableError } from "@/lib/errors"
import type { Context } from "@/env"

const jwtSecret = "authenticate-employee-test-secret"
const now = new Date("2026-01-01T00:00:00.000Z")

function mutateBeforeNextBatch(context: Context, mutation: () => Promise<unknown>): void {
  const source = context.env.DB
  let pending = true
  context.env.DB = new Proxy(source, {
    get(target, property, receiver) {
      if (property === "batch") {
        return async (statements: Array<D1PreparedStatement>) => {
          if (pending) {
            pending = false
            await mutation()
          }
          return target.batch(statements)
        }
      }

      return Reflect.get(target, property, receiver)
    },
  })
}

async function insertEmployee(
  db: D1Database,
  overrides: {
    id: number
    email: string
    passwordHash: string
    status?: "active" | "leave" | "retired"
  },
): Promise<void> {
  await seedD1(db, "employees", [
    {
      id: overrides.id,
      code: `E${String(overrides.id).padStart(3, "0")}`,
      name: "Test Worker",
      dept_id: null,
      dept_name: null,
      position: null,
      status: overrides.status ?? "active",
    },
  ])

  // 認証情報(identities)が正。テストの email/passwordHash を identity に持たせる。
  await seedIamForEmployees(db, [
    {
      id: overrides.id,
      email: overrides.email,
      passwordHash: overrides.passwordHash,
      role: "member",
    },
  ])
}

describe("AuthenticateEmployee", () => {
  test("returns an access token for valid new-format credentials", async () => {
    const { context, db } = createTestContext()

    const hash = await toPasswordHash("supersecret")

    await insertEmployee(db, { id: 1, email: "you+new@example.com", passwordHash: hash })

    const result = await new AuthenticateEmployee(context).run({
      email: "you+new@example.com",
      password: "supersecret",
      jwtSecret,
      userAgent: null,
      now,
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("expected access token")
    }

    if (result.refreshToken === null) {
      throw new Error("expected refresh token")
    }

    expect(result.accessToken.length > 0).toBe(true)
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/)
    expect(result.accountId).toBe(1)
    expect(result.employeeId).toBe(1)
    expect((await accessTokenService.verify(result.accessToken, jwtSecret)).ver).toBe(0)
    const sessionAudit = await db
      .prepare(
        `SELECT actor_account_id, action, target_type, target_id, outcome, reason_code,
                authorization_json, before_json, after_json, metadata_json, occurred_at
         FROM system_audit_events`,
      )
      .first<Record<string, unknown>>()
    expect(sessionAudit).toMatchObject({
      actor_account_id: "1",
      action: "auth.session.create",
      target_type: "session",
      outcome: "succeeded",
      reason_code: null,
      authorization_json: null,
      before_json: null,
      after_json: null,
      metadata_json:
        '{"client_ip":null,"client_name":"api","request_id":"00000000-0000-4000-8000-000000000000","transport_action":"auth.session.login_succeeded"}',
      occurred_at: 1_767_225_600_000,
    })
    expect(sessionAudit?.target_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    const refreshTokenHash = await new SystemSessionMaterialService().hashRawToken(
      result.refreshToken,
    )
    if (refreshTokenHash instanceof Error) throw refreshTokenHash
    expect(
      await db
        .prepare("SELECT token_hash, created_at, expires_at FROM system_sessions")
        .first<{ token_hash: string; created_at: number; expires_at: number }>(),
    ).toEqual({
      token_hash: refreshTokenHash,
      created_at: 1_767_225_600_000,
      expires_at: 1_767_830_400_000,
    })

    const persistedAudit = JSON.stringify(
      await db.prepare("SELECT * FROM system_audit_events").first<Record<string, unknown>>(),
    )
    expect(persistedAudit).not.toContain("you+new@example.com")
    expect(persistedAudit).not.toContain("supersecret")
    expect(persistedAudit).not.toContain(result.accessToken)
    expect(persistedAudit).not.toContain(result.refreshToken)
  })

  test.each([
    ["missing", "DELETE FROM system_accounts WHERE id = '1'"],
    [
      "suspended",
      "UPDATE system_accounts SET status = 'suspended', token_version = 1 WHERE id = '1'",
    ],
    ["locked", "UPDATE system_accounts SET status = 'locked', token_version = 1 WHERE id = '1'"],
  ])("fails closed without session material when the canonical account is %s", async (_, sql) => {
    const { context, db } = createTestContext()
    const hash = await toPasswordHash("supersecret")
    await insertEmployee(db, {
      id: 1,
      email: "you+canonical-rejected@example.com",
      passwordHash: hash,
    })
    await db.exec(sql)

    const result = await new AuthenticateEmployee(context).run({
      email: "you+canonical-rejected@example.com",
      password: "supersecret",
      jwtSecret,
      userAgent: null,
      now,
    })

    expect(result).toEqual({ reason: "invalid_credentials" })
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_sessions").first<number>("count"),
    ).toBe(0)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_audit_events").first<number>("count"),
    ).toBe(0)
  })

  test("uses canonical Account tokenVersion when issuing the access token", async () => {
    const { context, db } = createTestContext()
    const hash = await toPasswordHash("supersecret")
    await insertEmployee(db, {
      id: 1,
      email: "you+canonical-version@example.com",
      passwordHash: hash,
    })
    await db.exec("UPDATE system_accounts SET token_version = 1 WHERE id = '1'")

    const result = await new AuthenticateEmployee(context).run({
      email: "you+canonical-version@example.com",
      password: "supersecret",
      jwtSecret,
      userAgent: null,
      now,
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("expected access token")
    }

    expect((await accessTokenService.verify(result.accessToken, jwtSecret)).ver).toBe(1)
  })

  test("fails closed without session material when the canonical account cannot be read", async () => {
    const { context, db } = createTestContext()
    const hash = await toPasswordHash("supersecret")
    await insertEmployee(db, {
      id: 1,
      email: "you+canonical-error@example.com",
      passwordHash: hash,
    })
    await db.exec("DROP TABLE system_accounts")

    const result = await new AuthenticateEmployee(context).run({
      email: "you+canonical-error@example.com",
      password: "supersecret",
      jwtSecret,
      userAgent: null,
      now,
    })

    expect(result).toBeInstanceOf(Error)
    expect(result).toMatchObject({ code: "unexpected" })
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_sessions").first<number>("count"),
    ).toBe(0)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_audit_events").first<number>("count"),
    ).toBe(0)
  })

  test("does not persist or return a session after a canonical Account race", async () => {
    const { context, db } = createTestContext()
    const hash = await toPasswordHash("supersecret")
    await insertEmployee(db, {
      id: 1,
      email: "you+canonical-race@example.com",
      passwordHash: hash,
    })
    mutateBeforeNextBatch(context, () =>
      db
        .prepare("UPDATE system_accounts SET status = 'locked', token_version = 1 WHERE id = '1'")
        .run(),
    )

    const result = await new AuthenticateEmployee(context).run({
      email: "you+canonical-race@example.com",
      password: "supersecret",
      jwtSecret,
      userAgent: null,
      now,
    })

    expect(result).toBeInstanceOf(UnavailableError)
    expect(result).toMatchObject({ code: "audit_unavailable" })
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_sessions").first<number>("count"),
    ).toBe(0)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_audit_events").first<number>("count"),
    ).toBe(0)
  })

  test("rejects the wrong password with invalid_credentials", async () => {
    const { context, db } = createTestContext()

    const hash = await toPasswordHash("supersecret")

    await insertEmployee(db, { id: 1, email: "you+new@example.com", passwordHash: hash })

    const result = await new AuthenticateEmployee(context).run({
      email: "you+new@example.com",
      password: "wrong",
      jwtSecret,
      userAgent: null,
      now,
    })

    expect(result).toEqual({ reason: "invalid_credentials" })
  })

  test("returns invalid_credentials for an unknown email", async () => {
    const { context } = createTestContext()

    const result = await new AuthenticateEmployee(context).run({
      email: "you+absent@example.com",
      password: "whatever",
      jwtSecret,
      userAgent: null,
      now,
    })

    expect(result).toEqual({ reason: "invalid_credentials" })
  })

  test("rejects a retired employee with the correct password as invalid_credentials (#775)", async () => {
    const { context, db } = createTestContext()

    const hash = await toPasswordHash("supersecret")

    await insertEmployee(db, {
      id: 1,
      email: "you+retired@example.com",
      passwordHash: hash,
      status: "retired",
    })

    const result = await new AuthenticateEmployee(context).run({
      email: "you+retired@example.com",
      password: "supersecret",
      jwtSecret,
      userAgent: null,
      now,
    })

    // 在籍状態の漏えいを避けるため資格情報エラーと同一レスポンスを返す。
    expect(result).toEqual({ reason: "invalid_credentials" })
  })

  test("allows a leave employee to authenticate (#775, leave は現状許可)", async () => {
    const { context, db } = createTestContext()

    const hash = await toPasswordHash("supersecret")

    await insertEmployee(db, {
      id: 1,
      email: "you+leave@example.com",
      passwordHash: hash,
      status: "leave",
    })

    const result = await new AuthenticateEmployee(context).run({
      email: "you+leave@example.com",
      password: "supersecret",
      jwtSecret,
      userAgent: null,
      now,
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("expected access token")
    }

    expect(result.accessToken.length > 0).toBe(true)
  })

  test("does not rewrite a hash that is already in the new format", async () => {
    const { context, db } = createTestContext()

    const hash = await toPasswordHash("already-modern")

    await insertEmployee(db, { id: 1, email: "you+modern@example.com", passwordHash: hash })

    await new AuthenticateEmployee(context).run({
      email: "you+modern@example.com",
      password: "already-modern",
      jwtSecret,
      userAgent: null,
      now,
    })

    expect(
      await db
        .prepare(
          `SELECT credential.password_hash
           FROM system_password_credentials AS credential
           INNER JOIN system_identity_bindings AS identity
             ON identity.id = credential.identity_id
           WHERE identity.provider = 'password' AND identity.subject = ?1`,
        )
        .bind("you+modern@example.com")
        .first<string>("password_hash"),
    ).toBe(hash)
  })

  test("fails closed and rolls the refresh token back when the success audit insert fails", async () => {
    const { context, db } = createTestContext()
    const hash = await toPasswordHash("supersecret")
    await insertEmployee(db, { id: 1, email: "you+audit@example.com", passwordHash: hash })
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const result = await new AuthenticateEmployee(context).run({
      email: "you+audit@example.com",
      password: "supersecret",
      jwtSecret,
      userAgent: "application-test-agent",
      now,
    })

    expect(result).toBeInstanceOf(UnavailableError)
    expect((result as UnavailableError).code).toBe("audit_unavailable")
    expect((result as UnavailableError).message).toBe("invalid email or password")
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_sessions").first<number>("count"),
    ).toBe(0)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_audit_events").first<number>("count"),
    ).toBe(0)
  })
})
