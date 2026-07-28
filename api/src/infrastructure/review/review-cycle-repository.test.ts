import { ReviewCycle } from "@/domain/review/review-cycle.entity"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { describe, expect, test } from "bun:test"

describe("ReviewCycleRepository", () => {
  test("create then findById round-trips the review cycle", async () => {
    const { context } = createTestContext()

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
    const { context } = createTestContext()

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
