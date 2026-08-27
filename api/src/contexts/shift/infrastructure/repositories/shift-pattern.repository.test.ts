import { ShiftPattern } from "@/contexts/shift/domain/entities/shift-pattern.entity"
import { ShiftPatternRepository } from "@/contexts/shift/infrastructure/repositories/shift-pattern.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("ShiftPatternRepository", () => {
  test("create then findByCode round-trips the shift pattern", async () => {
    const { context } = await createTestContext()

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
