import { ReviewCycle } from "@/domain/review/review-cycle"
import { ReviewCycleRepository } from "@/infrastructure/review/review-cycle-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
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
})
