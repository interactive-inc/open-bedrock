import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { OneOnOne } from "@/contexts/one-on-one/domain/entities/one-on-one.entity"
import { OneOnOneRepository } from "@/contexts/one-on-one/infrastructure/repositories/oneonone/one-on-one.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"
import { UniqueConstraintError } from "@/lib/d1/errors"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "update",
      "save-persists-the-one-on-one",
      "save-returns-uniqueconstrainterror-for",
      "delete-returns-null-for-non-existent-id",
      "delete-returns-true-for-existing-record",
      "delete-returns-null-on-second-delete-of-same",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("OneOnOneRepository on local D1", () => {
  test("update persists the new record and returns null for an unknown id", async () => {
    const { context } = await createLocalD1Context(local, "update")

    const repository = new OneOnOneRepository(context)

    const created = OneOnOne.create({
      memberId: toWorkforceEmployeeId(testEmployeeId(2)),
      managerId: toWorkforceEmployeeId(testEmployeeId(1)),
      heldAt: "2026-03-15T10:00:00.000Z",
      topics: "progress review",
      managerNote: null,
      nextAction: null,
    })

    if ("reason" in created) throw new Error("unexpected self_reference")

    const saved = await repository.save(created)

    if (saved instanceof Error) throw saved

    const updated = await repository.update(
      saved.withRecord({
        topics: "updated topics",
        managerNote: "new note",
        nextAction: "action item",
      }),
    )

    expect(updated).toBeInstanceOf(OneOnOne)

    const reloaded = await repository.findById(saved.id)

    if (!(reloaded instanceof OneOnOne)) throw new Error("reload failed")

    expect(reloaded.topics).toBe("updated topics")
    expect(reloaded.managerNote).toBe("new note")
    expect(reloaded.nextAction).toBe("action item")

    const other = OneOnOne.create({
      memberId: toWorkforceEmployeeId(testEmployeeId(2)),
      managerId: toWorkforceEmployeeId(testEmployeeId(1)),
      heldAt: "2026-03-16T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    if ("reason" in other) throw new Error("unexpected self_reference")

    expect(await repository.update(other)).toBeNull()
  })
})

function createOneOnOne(): OneOnOne {
  const result = OneOnOne.create({
    memberId: toWorkforceEmployeeId(testEmployeeId(1)),
    managerId: toWorkforceEmployeeId(testEmployeeId(2)),
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
    const { context } = await createLocalD1Context(local, "save-persists-the-one-on-one")

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
    const { context } = await createLocalD1Context(local, "save-returns-uniqueconstrainterror-for")

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
    const { context } = await createLocalD1Context(local, "delete-returns-null-for-non-existent-id")

    const repository = new OneOnOneRepository(context)

    const deleted = await repository.delete("non-existent-uuid")

    expect(deleted).toBeNull()
  })

  test("delete returns true for existing record", async () => {
    const { context } = await createLocalD1Context(local, "delete-returns-true-for-existing-record")

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
    const { context } = await createLocalD1Context(
      local,
      "delete-returns-null-on-second-delete-of-same",
    )

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
