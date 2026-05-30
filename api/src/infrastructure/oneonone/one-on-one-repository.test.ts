import { OneOnOne } from "@/domain/oneonone/one-on-one"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("OneOnOneRepository", () => {
  test("save persists the one-on-one", async () => {
    const { context } = createTestContext()

    const repository = new OneOnOneRepository(context)

    const oneOnOne = OneOnOne.create({
      memberId: 1,
      managerId: 2,
      heldAt: "2026-01-01T00:00:00.000Z",
      topics: "今期の振り返り",
      managerNote: null,
      nextAction: null,
    })

    const saved = await repository.save(oneOnOne)

    expect(saved).toBeInstanceOf(OneOnOne)

    if (saved instanceof Error) {
      throw saved
    }

    expect(saved.id).toBe(oneOnOne.id)
    expect(saved.topics).toBe("今期の振り返り")
  })
})
