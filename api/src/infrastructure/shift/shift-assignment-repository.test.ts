import { ShiftAssignment } from "@/domain/shift/shift-assignment"
import { ShiftAssignmentRepository } from "@/infrastructure/shift/shift-assignment-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("ShiftAssignmentRepository", () => {
  test("create then findById round-trips the shift assignment", async () => {
    const { context } = createTestContext()

    const repository = new ShiftAssignmentRepository(context)

    const created = await repository.create(
      ShiftAssignment.create({
        employeeId: 1,
        patternId: null,
        date: "2026-05-31",
        note: null,
      }),
    )

    expect(created).toBeInstanceOf(ShiftAssignment)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(ShiftAssignment)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.date).toBe("2026-05-31")
    expect(found.publishedAt).toBeNull()
  })
})
