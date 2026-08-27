import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("GoalRepository", () => {
  test("create then findById round-trips the goal", async () => {
    const { context } = await createTestContext()

    const repository = new GoalRepository(context)

    const created = await repository.create(
      Goal.create({
        employeeId: toWorkforceEmployeeId(1),
        period: "2026-H1",
        title: "テスト目標",
        kpi: null,
        weight: 10,
      }),
    )

    expect(created).toBeInstanceOf(Goal)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(Goal)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.title).toBe("テスト目標")
    expect(found.status).toBe("draft")
  })

  test("update persists the status change", async () => {
    const { context } = await createTestContext()

    const repository = new GoalRepository(context)

    const created = await repository.create(
      Goal.create({
        employeeId: toWorkforceEmployeeId(1),
        period: "2026-H1",
        title: "テスト目標",
        kpi: null,
        weight: 10,
      }),
    )

    if (created instanceof Error) {
      throw created
    }

    const updated = await repository.update(created.withStatus("done"))

    expect(updated).toBeInstanceOf(Goal)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.status).toBe("done")
  })

  test("findById returns null for an unknown id", async () => {
    const { context } = await createTestContext()

    const repository = new GoalRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })
})
