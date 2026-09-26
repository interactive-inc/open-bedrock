import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { AntisocialCheck } from "@/contexts/antisocial-check/domain/entities/antisocial-check.entity"
import { AntisocialCheckRepository } from "@/contexts/antisocial-check/infrastructure/repositories/antisocial-check.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["update"] })
})

afterAll(async () => {
  await local.dispose()
})

describe("AntisocialCheckRepository on local D1", () => {
  test("persists a created check, completes it once and refuses a second update", async () => {
    const { context } = await createLocalD1Context(local, "update")

    const repository = new AntisocialCheckRepository(context)

    const created = await repository.create(
      AntisocialCheck.create({
        requesterId: toWorkforceEmployeeId(testEmployeeId(5)),
        partnerName: "Example Trading Co.",
        partnerAddress: null,
        representativeName: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error) throw created

    const found = await repository.findById(created.id)

    if (found === null || found instanceof Error) throw new Error("check not persisted")

    expect(found.status).toBe("requested")
    expect(found.result).toBe(null)

    const completed = await repository.update(
      found.withDetails({
        partnerName: found.partnerName,
        partnerAddress: found.partnerAddress,
        representativeName: found.representativeName,
        result: "clear",
      }),
    )

    if (completed === null || completed instanceof Error) throw new Error("update failed")

    expect(completed.status).toBe("completed")
    expect(completed.result).toBe("clear")

    const again = await repository.update(
      completed.withDetails({
        partnerName: "Changed Name",
        partnerAddress: null,
        representativeName: null,
        result: "clear",
      }),
    )

    expect(again).toBe(null)

    const reloaded = await repository.findById(created.id)

    if (reloaded === null || reloaded instanceof Error) throw new Error("check disappeared")

    expect(reloaded.partnerName).toBe("Example Trading Co.")
    expect(reloaded.status).toBe("completed")
  })
})
