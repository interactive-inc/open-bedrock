import { Goal } from "@/domain/goal/goal"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("GoalRepository", () => {
  test("create then findById round-trips the goal", async () => {
    const { context } = createTestContext()

    const repository = new GoalRepository(context)

    const created = await repository.create(
      Goal.create({
        employeeId: 1,
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
    const { context } = createTestContext()

    const repository = new GoalRepository(context)

    const created = await repository.create(
      Goal.create({
        employeeId: 1,
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
    const { context } = createTestContext()

    const repository = new GoalRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })
})
