import { describe, expect, test } from "bun:test"
import { AuthenticateEmployee } from "@/application/auth/authenticate-employee"
import { isLegacyPasswordHash } from "@/lib/auth/is-legacy-password-hash"
import { toLegacyPasswordHash } from "@/lib/auth/to-legacy-password-hash"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { wrapLegacyHash } from "@/lib/auth/wrap-legacy-hash"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { UnavailableError } from "@/lib/errors"

const jwtSecret = "authenticate-employee-test-secret"
const now = new Date("2026-01-01T00:00:00.000Z")

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

    expect(result.accessToken.length > 0).toBe(true)
    expect(result.accountId).toBe(1)
    expect(result.employeeId).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT actor_account_id, actor_employee_id, action, target_type, target_id,
                  outcome, reason_code, authorization_json, before_json, after_json,
                  metadata_json, client_ip, client_name, request_id, created_at
           FROM audit_events`,
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
      client_ip: null,
      client_name: "api",
      request_id: "00000000-0000-4000-8000-000000000000",
      created_at: 1_767_225_600,
    })
    expect(
      await db
        .prepare("SELECT created_at, expires_at FROM refresh_tokens")
        .first<{ created_at: number; expires_at: number }>(),
    ).toEqual({ created_at: 1_767_225_600, expires_at: 1_767_830_400 })

    const persistedAudit = JSON.stringify(
      await db.prepare("SELECT * FROM audit_events").first<Record<string, unknown>>(),
    )
    expect(persistedAudit).not.toContain("you+new@example.com")
    expect(persistedAudit).not.toContain("supersecret")
    expect(persistedAudit).not.toContain(result.accessToken)
    expect(persistedAudit).not.toContain(result.refreshToken)
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

  test("authenticates against a legacy hash and rehashes to the new format", async () => {
    const { context, db } = createTestContext()

    const legacyHash = await toLegacyPasswordHash("legacy-password")

    await insertEmployee(db, {
      id: 1,
      email: "you+legacy@example.com",
      passwordHash: legacyHash,
    })

    const result = await new AuthenticateEmployee(context).run({
      email: "you+legacy@example.com",
      password: "legacy-password",
      jwtSecret,
      userAgent: null,
      now,
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("expected access token")
    }

    // 段階移行: ログイン後は identity の secret が新形式に書き換えられているはず。
    const repository = new IdentityRepository(context)

    const found = await repository.findPasswordIdentityByEmail("you+legacy@example.com")

    if (found === null || found instanceof Error || found.secret === null) {
      throw new Error("identity should exist")
    }

    expect(isLegacyPasswordHash(found.secret)).toBe(false)
    expect(found.secret.startsWith("pbkdf2:")).toBe(true)
  })

  test("authenticates against a wrapped-legacy hash and upgrades to pure PBKDF2", async () => {
    const { context, db } = createTestContext()

    const legacyHash = await toLegacyPasswordHash("wrapped-password")
    const wrappedHash = await wrapLegacyHash(legacyHash)

    await insertEmployee(db, {
      id: 1,
      email: "you+wrapped@example.com",
      passwordHash: wrappedHash,
    })

    const result = await new AuthenticateEmployee(context).run({
      email: "you+wrapped@example.com",
      password: "wrapped-password",
      jwtSecret,
      userAgent: null,
      now,
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("expected access token")
    }

    // ログイン後は identity の secret が純正 PBKDF2 に昇格しているはず。
    const repository = new IdentityRepository(context)

    const found = await repository.findPasswordIdentityByEmail("you+wrapped@example.com")

    if (found === null || found instanceof Error || found.secret === null) {
      throw new Error("identity should exist")
    }

    expect(found.secret.startsWith("pbkdf2:")).toBe(true)
    expect(found.secret.startsWith("pbkdf2-wrapped-legacy:")).toBe(false)
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

    const repository = new IdentityRepository(context)

    const found = await repository.findPasswordIdentityByEmail("you+modern@example.com")

    if (found === null || found instanceof Error) {
      throw new Error("identity should exist")
    }

    // 既に新形式なので、ハッシュ値そのものが変化していないこと。
    expect(found.secret).toBe(hash)
  })

  test("fails closed and rolls the refresh token back when the success audit insert fails", async () => {
    const { context, db } = createTestContext()
    const hash = await toPasswordHash("supersecret")
    await insertEmployee(db, { id: 1, email: "you+audit@example.com", passwordHash: hash })
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
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
      await db.prepare("SELECT COUNT(*) AS count FROM refresh_tokens").first<number>("count"),
    ).toBe(0)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
  })
})
