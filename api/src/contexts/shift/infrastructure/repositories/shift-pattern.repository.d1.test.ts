import { ShiftPattern } from "@/contexts/shift/domain/entities/shift-pattern.entity"
import { ShiftPatternRepository } from "@/contexts/shift/infrastructure/repositories/shift-pattern.repository"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["create-then-findbycode-round-trips-the-shift"],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("ShiftPatternRepository", () => {
  test("create then findByCode round-trips the shift pattern", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-then-findbycode-round-trips-the-shift",
    )

    const repository = new ShiftPatternRepository(context)

    const created = await repository.create(
      ShiftPattern.create({
        code: "EARLY",
        name: "早番",
        startTime: "07:00",
        endTime: "16:00",
        breakMinutes: 60,
      }),
    )

    expect(created).toBeInstanceOf(ShiftPattern)

    if (created instanceof Error) {
      throw created
    }

    const found = await repository.findByCode("EARLY")

    expect(found).toBeInstanceOf(ShiftPattern)

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.name).toBe("早番")
    expect(found.breakMinutes).toBe(60)
  })
})
