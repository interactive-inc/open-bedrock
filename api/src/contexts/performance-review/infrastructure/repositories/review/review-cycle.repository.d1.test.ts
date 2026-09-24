import { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["create-then-findbyid-round-trips-the-review", "findmany-respects-limit-and-offset"],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("ReviewCycleRepository", () => {
  test("create then findById round-trips the review cycle", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-then-findbyid-round-trips-the-review",
    )

    const repository = new ReviewCycleRepository(context)

    const created = await repository.create(
      ReviewCycle.create({
        title: "上期評価",
        period: "2026-H1",
        dueDate: null,
      }),
    )

    expect(created).toBeInstanceOf(ReviewCycle)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(ReviewCycle)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.title).toBe("上期評価")
    expect(found.status).toBe("draft")
  })

  test("findMany respects limit and offset", async () => {
    const { context } = await createLocalD1Context(local, "findmany-respects-limit-and-offset")

    const repository = new ReviewCycleRepository(context)

    await repository.create(
      ReviewCycle.create({ title: "上期評価", period: "2026-H1", dueDate: null }),
    )
    await repository.create(
      ReviewCycle.create({ title: "下期評価", period: "2026-H2", dueDate: null }),
    )

    const firstPage = await repository.findMany({ limit: 1, offset: 0 })

    if (firstPage instanceof Error) {
      throw firstPage
    }

    expect(firstPage.length).toBe(1)
    expect(firstPage[0]?.title).toBe("上期評価")

    const secondPage = await repository.findMany({ limit: 1, offset: 1 })

    if (secondPage instanceof Error) {
      throw secondPage
    }

    expect(secondPage.length).toBe(1)
    expect(secondPage[0]?.title).toBe("下期評価")
  })
})
