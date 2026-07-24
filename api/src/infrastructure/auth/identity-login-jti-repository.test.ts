import { describe, expect, test } from "bun:test"
import { IdentityLoginJtiRepository } from "@/infrastructure/auth/identity-login-jti-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"

describe("IdentityLoginJtiRepository", () => {
  test("records a jti on first use and detects a replay on the second", async () => {
    const { context, db } = createTestContext()
    const repository = new IdentityLoginJtiRepository(context)

    const first = await repository.markUsed("jti-1", 1_767_225_660, 1_767_225_600)
    expect(first).toBe("recorded")

    const second = await repository.markUsed("jti-1", 1_767_225_660, 1_767_225_600)
    expect(second).toBe("replayed")

    const count = await db
      .prepare("SELECT COUNT(*) AS n FROM identity_login_jti WHERE jti = 'jti-1'")
      .first<number>("n")
    expect(count).toBe(1)
  })

  test("records distinct jti values independently", async () => {
    const { context } = createTestContext()
    const repository = new IdentityLoginJtiRepository(context)

    expect(await repository.markUsed("jti-a", 100, 1)).toBe("recorded")
    expect(await repository.markUsed("jti-b", 100, 1)).toBe("recorded")
  })
})
