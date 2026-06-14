import { CareerSheet } from "@/domain/career/career-sheet.entity"
import { CareerSheetRepository } from "@/infrastructure/career/career-sheet-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("CareerSheetRepository", () => {
  test("upsert returns the persisted sheet", async () => {
    const { context } = createTestContext()

    const repository = new CareerSheetRepository(context)

    const upserted = await repository.upsert(
      CareerSheet.create({
        employeeId: 1,
        goalsText: "目標",
        strengthsText: "強み",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(upserted).toBeInstanceOf(CareerSheet)

    if (upserted instanceof Error) {
      throw upserted
    }

    expect(upserted.employeeId).toBe(1)
    expect(upserted.goalsText).toBe("目標")
  })
})
