import { describe, expect, test } from "bun:test"
import { CliLoginStateRepository } from "@/contexts/system-compatibility/infrastructure/auth/cli-login-state-repository"
import { createTestContext } from "@/api/test/support/create-test-context"

describe("CliLoginStateRepository", () => {
  test("consumes a recorded state exactly once", async () => {
    const { context } = createTestContext()
    const repository = new CliLoginStateRepository(context)

    const created = await repository.create(
      "state-1",
      { port: 51820, cliState: "cli-state-1", codeVerifier: "verifier-1" },
      1_767_225_900,
    )
    expect(created).toBeNull()

    const first = await repository.consume("state-1", 1_767_225_600)
    expect(first).toEqual({
      port: 51820,
      cliState: "cli-state-1",
      codeVerifier: "verifier-1",
    })

    const second = await repository.consume("state-1", 1_767_225_600)
    expect(second).toBeNull()
  })

  test("does not return an expired state", async () => {
    const { context } = createTestContext()
    const repository = new CliLoginStateRepository(context)

    await repository.create(
      "state-expired",
      { port: 1, cliState: "s", codeVerifier: "verifier-expired" },
      1_767_225_600,
    )

    const result = await repository.consume("state-expired", 1_767_225_600)
    expect(result).toBeNull()
  })

  test("returns null for an unknown state", async () => {
    const { context } = createTestContext()
    const repository = new CliLoginStateRepository(context)

    expect(await repository.consume("never-issued", 0)).toBeNull()
  })
})
