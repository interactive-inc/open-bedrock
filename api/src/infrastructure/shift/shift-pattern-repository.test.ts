import { ShiftPattern } from "@/domain/shift/shift-pattern"
import { ShiftPatternRepository } from "@/infrastructure/shift/shift-pattern-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("ShiftPatternRepository", () => {
  test("create then findByCode round-trips the shift pattern", async () => {
    const { context } = createTestContext()

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
