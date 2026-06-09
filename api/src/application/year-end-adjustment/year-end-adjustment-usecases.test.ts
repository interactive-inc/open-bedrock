import { describe, expect, test } from "bun:test"
import { CancelYearEndAdjustment } from "@/application/year-end-adjustment/cancel-year-end-adjustment"
import { CreateYearEndAdjustment } from "@/application/year-end-adjustment/create-year-end-adjustment"
import { GetYearEndAdjustment } from "@/application/year-end-adjustment/get-year-end-adjustment"
import { ListMyYearEndAdjustments } from "@/application/year-end-adjustment/list-my-year-end-adjustments"
import { UpdateYearEndAdjustment } from "@/application/year-end-adjustment/update-year-end-adjustment"
import { YearEndAdjustment } from "@/domain/year-end-adjustment/year-end-adjustment"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/shared/test/create-test-context"

async function seedAdjustment(context: Context, employeeId: number): Promise<string> {
  const created = await new CreateYearEndAdjustment(context).run({
    employeeId: employeeId,
    targetYear: 2025,
    note: "Initial submission",
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  if ("kind" in created) {
    throw new Error("seed failed: already submitted")
  }

  return created.id
}

describe("CreateYearEndAdjustment", () => {
  test("creates a year end adjustment with status submitted", async () => {
    const { context } = createTestContext()

    const created = await new CreateYearEndAdjustment(context).run({
      employeeId: 2,
      targetYear: 2025,
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(YearEndAdjustment)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    if ("kind" in created) {
      throw new Error("create failed: already submitted")
    }

    expect(created.status).toBe("submitted")
    expect(created.note).toBe(null)
  })
})

describe("GetYearEndAdjustment", () => {
  test("returns the adjustment for its applicant", async () => {
    const { context } = createTestContext()

    const adjustmentId = await seedAdjustment(context, 5)

    const result = await new GetYearEndAdjustment(context).run({
      yearEndAdjustmentId: adjustmentId,
      employeeId: 5,
    })

    expect(result).toBeInstanceOf(YearEndAdjustment)
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const adjustmentId = await seedAdjustment(context, 5)

    const result = await new GetYearEndAdjustment(context).run({
      yearEndAdjustmentId: adjustmentId,
      employeeId: 6,
    })

    expect(result).toEqual({ reason: "not_applicant" })
  })

  test("returns year_end_adjustment_not_found for an unknown id", async () => {
    const { context } = createTestContext()

    const result = await new GetYearEndAdjustment(context).run({
      yearEndAdjustmentId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "year_end_adjustment_not_found" })
  })
})

describe("ListMyYearEndAdjustments", () => {
  test("returns only the applicant's adjustments", async () => {
    const { context } = createTestContext()

    await seedAdjustment(context, 5)

    await seedAdjustment(context, 6)

    const result = await new ListMyYearEndAdjustments(context).run({ employeeId: 5 })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
    expect(result[0].employeeId).toBe(5)
  })
})

describe("UpdateYearEndAdjustment", () => {
  test("updates the details for the applicant", async () => {
    const { context } = createTestContext()

    const adjustmentId = await seedAdjustment(context, 5)

    const result = await new UpdateYearEndAdjustment(context).run({
      yearEndAdjustmentId: adjustmentId,
      employeeId: 5,
      targetYear: 2024,
      note: "Updated remarks",
    })

    expect(result).toBeInstanceOf(YearEndAdjustment)

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.targetYear).toBe(2024)
    expect(result.note).toBe("Updated remarks")
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const adjustmentId = await seedAdjustment(context, 5)

    const result = await new UpdateYearEndAdjustment(context).run({
      yearEndAdjustmentId: adjustmentId,
      employeeId: 6,
      targetYear: 2024,
      note: null,
    })

    expect(result).toEqual({ reason: "not_applicant" })
  })
})

describe("CancelYearEndAdjustment", () => {
  test("cancels the adjustment for the applicant", async () => {
    const { context } = createTestContext()

    const adjustmentId = await seedAdjustment(context, 5)

    const result = await new CancelYearEndAdjustment(context).run({
      yearEndAdjustmentId: adjustmentId,
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const adjustmentId = await seedAdjustment(context, 5)

    const result = await new CancelYearEndAdjustment(context).run({
      yearEndAdjustmentId: adjustmentId,
      employeeId: 6,
    })

    expect(result).toEqual({ reason: "not_applicant" })
  })
})
