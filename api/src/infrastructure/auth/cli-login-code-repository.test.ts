import { describe, expect, test } from "bun:test"
import { CliLoginCodeRepository } from "@/infrastructure/auth/cli-login-code-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"

describe("CliLoginCodeRepository", () => {
  test("consumes a recorded code exactly once", async () => {
    const { context } = createTestContext()
    const repository = new CliLoginCodeRepository(context)

    const created = await repository.create(
      "code-hash-1",
      { accessToken: "access-1", refreshToken: "refresh-1" },
      1_767_225_900,
    )
    expect(created).toBeNull()

    const first = await repository.consume("code-hash-1", 1_767_225_600)
    expect(first).toEqual({ accessToken: "access-1", refreshToken: "refresh-1" })

    const second = await repository.consume("code-hash-1", 1_767_225_600)
    expect(second).toBeNull()
  })

  test("does not return an expired code", async () => {
    const { context } = createTestContext()
    const repository = new CliLoginCodeRepository(context)

    await repository.create(
      "code-hash-expired",
      { accessToken: "a", refreshToken: "r" },
      1_767_225_600,
    )

    const result = await repository.consume("code-hash-expired", 1_767_225_600)
    expect(result).toBeNull()
  })

  test("returns null for an unknown code hash", async () => {
    const { context } = createTestContext()
    const repository = new CliLoginCodeRepository(context)

    expect(await repository.consume("never-issued", 0)).toBeNull()
  })
})
