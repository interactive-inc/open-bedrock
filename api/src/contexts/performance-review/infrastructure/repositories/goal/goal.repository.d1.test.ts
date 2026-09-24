import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "create-then-findbyid-round-trips-the-goal",
      "update-persists-the-status-change",
      "findbyid-returns-null-for-an-unknown-id",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("GoalRepository", () => {
  test("create then findById round-trips the goal", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-then-findbyid-round-trips-the-goal",
    )

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
    const { context } = await createLocalD1Context(local, "update-persists-the-status-change")

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
    const { context } = await createLocalD1Context(local, "findbyid-returns-null-for-an-unknown-id")

    const repository = new GoalRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })
})
