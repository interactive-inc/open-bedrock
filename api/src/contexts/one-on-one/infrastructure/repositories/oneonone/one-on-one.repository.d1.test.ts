import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { OneOnOne } from "@/contexts/one-on-one/domain/entities/one-on-one.entity"
import { OneOnOneRepository } from "@/contexts/one-on-one/infrastructure/repositories/oneonone/one-on-one.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["update"] })
})

afterAll(async () => {
  await local.dispose()
})

describe("OneOnOneRepository on local D1", () => {
  test("update persists the new record and returns null for an unknown id", async () => {
    const { context } = await createLocalD1Context(local, "update")

    const repository = new OneOnOneRepository(context)

    const created = OneOnOne.create({
      memberId: toWorkforceEmployeeId(2),
      managerId: toWorkforceEmployeeId(1),
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
      memberId: toWorkforceEmployeeId(2),
      managerId: toWorkforceEmployeeId(1),
      heldAt: "2026-03-16T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    if ("reason" in other) throw new Error("unexpected self_reference")

    expect(await repository.update(other)).toBeNull()
  })
})
