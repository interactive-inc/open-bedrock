import { describe, expect, test } from "bun:test"
import { AuthenticateEmployee } from "@/application/auth/authenticate-employee"
import { isLegacyPasswordHash, toLegacyPasswordHash } from "@/lib/auth/legacy-password-hash"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { wrapLegacyHash } from "@/lib/auth/wrap-legacy-hash"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"

const jwtSecret = "authenticate-employee-test-secret"

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
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("expected access token")
    }

    expect(result.accessToken.length > 0).toBe(true)
  })

  test("rejects the wrong password with invalid_credentials", async () => {
    const { context, db } = createTestContext()

    const hash = await toPasswordHash("supersecret")

    await insertEmployee(db, { id: 1, email: "you+new@example.com", passwordHash: hash })

    const result = await new AuthenticateEmployee(context).run({
      email: "you+new@example.com",
      password: "wrong",
      jwtSecret,
    })

    expect(result).toEqual({ reason: "invalid_credentials" })
  })

  test("returns invalid_credentials for an unknown email", async () => {
    const { context } = createTestContext()

    const result = await new AuthenticateEmployee(context).run({
      email: "you+absent@example.com",
      password: "whatever",
      jwtSecret,
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
    })

    const repository = new IdentityRepository(context)

    const found = await repository.findPasswordIdentityByEmail("you+modern@example.com")

    if (found === null || found instanceof Error) {
      throw new Error("identity should exist")
    }

    // 既に新形式なので、ハッシュ値そのものが変化していないこと。
    expect(found.secret).toBe(hash)
  })
})
