import { OneOnOne } from "@/domain/oneonone/one-on-one.entity"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { describe, expect, test } from "bun:test"

function createOneOnOne(): OneOnOne {
  const result = OneOnOne.create({
    memberId: 1,
    managerId: 2,
    heldAt: "2026-01-01T00:00:00.000Z",
    topics: "今期の振り返り",
    managerNote: null,
    nextAction: null,
  })

  if ("reason" in result) {
    throw new Error("unexpected self_reference")
  }

  return result
}

describe("OneOnOneRepository", () => {
  test("save persists the one-on-one", async () => {
    const { context } = createTestContext()

    const repository = new OneOnOneRepository(context)

    const oneOnOne = createOneOnOne()

    const saved = await repository.save(oneOnOne)

    expect(saved).toBeInstanceOf(OneOnOne)

    if (saved instanceof Error) {
      throw saved
    }

    expect(saved.id).toBe(oneOnOne.id)
    expect(saved.topics).toBe("今期の振り返り")
  })

  test("save returns UniqueConstraintError for duplicate id", async () => {
    const { context } = createTestContext()

    const repository = new OneOnOneRepository(context)

    const oneOnOne = createOneOnOne()

    const first = await repository.save(oneOnOne)

    if (first instanceof Error) {
      throw first
    }

    const second = await repository.save(oneOnOne)

    expect(second).toBeInstanceOf(UniqueConstraintError)
  })

  test("delete returns null for non-existent id", async () => {
    const { context } = createTestContext()

    const repository = new OneOnOneRepository(context)

    const deleted = await repository.delete("non-existent-uuid")

    expect(deleted).toBeNull()
  })

  test("delete returns true for existing record", async () => {
    const { context } = createTestContext()

    const repository = new OneOnOneRepository(context)

    const oneOnOne = createOneOnOne()

    const saved = await repository.save(oneOnOne)

    if (saved instanceof Error) {
      throw saved
    }

    const deleted = await repository.delete(oneOnOne.id)

    expect(deleted).toBe(true)
  })

  test("delete returns null on second delete of same record", async () => {
    const { context } = createTestContext()

    const repository = new OneOnOneRepository(context)

    const oneOnOne = createOneOnOne()

    const saved = await repository.save(oneOnOne)

    if (saved instanceof Error) {
      throw saved
    }

    const first = await repository.delete(oneOnOne.id)

    expect(first).toBe(true)

    const second = await repository.delete(oneOnOne.id)

    expect(second).toBeNull()
  })
})
