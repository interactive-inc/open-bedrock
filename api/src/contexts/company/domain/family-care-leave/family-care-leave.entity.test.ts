import { FamilyCareLeave } from "@/contexts/company/domain/family-care-leave/family-care-leave.entity"
import { describe, expect, test } from "bun:test"

describe("FamilyCareLeave.create", () => {
  test("builds instance with valid dates", () => {
    const leave = FamilyCareLeave.create({
      employeeId: 1,
      leaveKind: "maternity",
      startDate: "2026-09-01",
      endDate: "2027-03-01",
      note: "産前産後休業",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(leave).toBeInstanceOf(FamilyCareLeave)

    if (!(leave instanceof FamilyCareLeave)) {
      throw new Error("expected FamilyCareLeave")
    }

    expect(leave.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(leave.status).toBe("requested")
    expect(leave.employeeId).toBe(1)
    expect(leave.leaveKind).toBe("maternity")
    expect(leave.startDate).toBe("2026-09-01")
    expect(leave.endDate).toBe("2027-03-01")
    expect(leave.note).toBe("産前産後休業")
  })

  test("returns error when startDate is after endDate", () => {
    const leave = FamilyCareLeave.create({
      employeeId: 1,
      leaveKind: "childcare",
      startDate: "2027-04-01",
      endDate: "2027-03-01",
      note: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(leave).toEqual({ reason: "invalid_date_range" })
  })
})

describe("FamilyCareLeave.withDetails", () => {
  test("returns new instance with valid dates", () => {
    const leave = FamilyCareLeave.create({
      employeeId: 1,
      leaveKind: "maternity",
      startDate: "2026-09-01",
      endDate: "2027-03-01",
      note: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    if (!(leave instanceof FamilyCareLeave)) {
      throw new Error("expected FamilyCareLeave")
    }

    const updated = leave.withDetails({
      leaveKind: "childcare",
      startDate: "2027-03-01",
      endDate: "2028-03-01",
      note: "育児休業に変更",
    })

    expect(updated).toBeInstanceOf(FamilyCareLeave)

    if (!(updated instanceof FamilyCareLeave)) {
      throw new Error("expected FamilyCareLeave")
    }

    expect(updated.leaveKind).toBe("childcare")
    expect(updated.startDate).toBe("2027-03-01")
    expect(updated.endDate).toBe("2028-03-01")
    expect(updated.note).toBe("育児休業に変更")
    expect(updated.employeeId).toBe(1)
  })

  test("returns error with invalid dates", () => {
    const leave = FamilyCareLeave.create({
      employeeId: 1,
      leaveKind: "care",
      startDate: "2026-09-01",
      endDate: "2027-03-01",
      note: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    if (!(leave instanceof FamilyCareLeave)) {
      throw new Error("expected FamilyCareLeave")
    }

    const updated = leave.withDetails({
      leaveKind: "care",
      startDate: "2027-06-01",
      endDate: "2027-03-01",
      note: null,
    })

    expect(updated).toEqual({ reason: "invalid_date_range" })
  })
})
