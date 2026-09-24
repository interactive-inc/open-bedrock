import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CareerSheet } from "@/contexts/career/domain/entities/career-sheet.entity"
import { CareerSheetRepository } from "@/contexts/career/infrastructure/repositories/career-sheet.repository"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["upsert-returns-the-persisted-sheet"],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("CareerSheetRepository", () => {
  test("upsert returns the persisted sheet", async () => {
    const { context } = await createLocalD1Context(local, "upsert-returns-the-persisted-sheet")

    const repository = new CareerSheetRepository(context)

    const upserted = await repository.upsert(
      CareerSheet.create({
        employeeId: toWorkforceEmployeeId(1),
        goalsText: "目標",
        strengthsText: "強み",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(upserted).toBeInstanceOf(CareerSheet)

    if (upserted instanceof Error) {
      throw upserted
    }

    expect(upserted.employeeId).toBe(toWorkforceEmployeeId(1))
    expect(upserted.goalsText).toBe("目標")
  })
})
