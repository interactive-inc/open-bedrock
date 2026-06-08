import { describe, expect, test } from "bun:test"
import { AuthenticateEmployee } from "@/application/auth/authenticate-employee"
import { isLegacyPasswordHash, toLegacyPasswordHash } from "@/domain/auth/legacy-password-hash"
import { toPasswordHash } from "@/domain/auth/to-password-hash"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"

const jwtSecret = "authenticate-employee-test-secret"

async function insertEmployee(
  db: D1Database,
  overrides: { id: number; email: string; passwordHash: string },
): Promise<void> {
  await seedD1(db, "employees", [
    {
      id: overrides.id,
      code: `E${String(overrides.id).padStart(3, "0")}`,
      name: "Test Worker",
      email: overrides.email,
      password_hash: overrides.passwordHash,
      role: "member",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
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

    // 段階移行: ログイン後は新形式に書き換えられているはず。
    const repository = new EmployeeRepository(context)

    const found = await repository.findByEmail("you+legacy@example.com")

    if (found === null || found instanceof Error) {
      throw new Error("employee should exist")
    }

    expect(isLegacyPasswordHash(found.passwordHash)).toBe(false)
    expect(found.passwordHash.startsWith("pbkdf2:")).toBe(true)
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

    const repository = new EmployeeRepository(context)

    const found = await repository.findByEmail("you+modern@example.com")

    if (found === null || found instanceof Error) {
      throw new Error("employee should exist")
    }

    // 既に新形式なので、ハッシュ値そのものが変化していないこと。
    expect(found.passwordHash).toBe(hash)
  })
})
