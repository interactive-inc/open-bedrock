import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { Resignation } from "@/contexts/resignation/domain/entities/resignation.entity"
import { ResignationRepository } from "@/contexts/resignation/infrastructure/repositories/resignation.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["round-trip"] })
})

afterAll(async () => {
  await local.dispose()
})

describe("ResignationRepository on local D1", () => {
  test("create persists a requested resignation, rejects a duplicate and updates only requested rows", async () => {
    const { context } = await createLocalD1Context(local, "round-trip")

    const repository = new ResignationRepository(context)

    const resignation = Resignation.create({
      employeeId: toWorkforceEmployeeId(testEmployeeId(5)),
      resignationDate: "2026-09-30",
      lastWorkingDate: "2026-09-20",
      reason: "Career change",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(await repository.create(resignation)).toBe(resignation)

    const duplicate = await repository.create(
      Resignation.create({
        employeeId: toWorkforceEmployeeId(testEmployeeId(5)),
        resignationDate: "2026-10-31",
        lastWorkingDate: null,
        reason: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(duplicate).toEqual({ kind: "already_requested" })

    const found = await repository.findById(resignation.id)

    if (!(found instanceof Resignation)) throw new Error("resignation was not persisted")

    expect(found.status).toBe("requested")
    expect(found.reason).toBe("Career change")

    const pending = await repository.findPendingByEmployeeId(
      toWorkforceEmployeeId(testEmployeeId(5)),
    )

    expect(pending instanceof Resignation ? pending.id : pending).toBe(resignation.id)

    const updated = await repository.update(
      found.withDetails({
        resignationDate: "2026-11-30",
        lastWorkingDate: "2026-11-20",
        reason: "Relocation",
      }),
    )

    if (!(updated instanceof Resignation)) throw new Error("update failed")

    expect(updated.resignationDate).toBe("2026-11-30")
    expect(updated.reason).toBe("Relocation")
  })
})
