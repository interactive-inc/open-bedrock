import { YearEndAdjustment } from "@/domain/year-end-adjustment/year-end-adjustment.entity"
import { describe, expect, test } from "bun:test"

describe("YearEndAdjustment.create", () => {
  test("builds with UUID id and submitted status", () => {
    const adjustment = YearEndAdjustment.create({
      employeeId: 1,
      targetYear: 2026,
      note: "扶養控除あり",
      createdAt: "2026-11-01T00:00:00.000Z",
    })

    expect(adjustment).toBeInstanceOf(YearEndAdjustment)
    expect(adjustment.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(adjustment.status).toBe("submitted")
    expect(adjustment.employeeId).toBe(1)
    expect(adjustment.targetYear).toBe(2026)
    expect(adjustment.note).toBe("扶養控除あり")
  })
})

describe("YearEndAdjustment.isModifiable", () => {
  test("returns true for submitted status", () => {
    const adjustment = YearEndAdjustment.create({
      employeeId: 1,
      targetYear: 2026,
      note: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    })

    expect(adjustment.isModifiable).toBe(true)
  })

  test("returns false for non-submitted status", () => {
    const adjustment = new YearEndAdjustment({
      id: crypto.randomUUID(),
      employeeId: 1,
      targetYear: 2026,
      note: null,
      status: "completed",
      createdAt: "2026-11-01T00:00:00.000Z",
    })

    expect(adjustment.isModifiable).toBe(false)
  })
})

describe("YearEndAdjustment.withDetails", () => {
  test("returns new instance with updated fields", () => {
    const adjustment = YearEndAdjustment.create({
      employeeId: 1,
      targetYear: 2026,
      note: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    })

    const updated = adjustment.withDetails({
      targetYear: 2025,
      note: "修正申告",
    })

    expect(updated).toBeInstanceOf(YearEndAdjustment)
    expect(updated.targetYear).toBe(2025)
    expect(updated.note).toBe("修正申告")
    expect(updated.employeeId).toBe(1)
    expect(updated.status).toBe("submitted")
  })
})
