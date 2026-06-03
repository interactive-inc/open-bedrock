import { describe, expect, test } from "bun:test"
import { CancelFamilyCareLeave } from "@/application/family-care-leave/cancel-family-care-leave"
import { CreateFamilyCareLeave } from "@/application/family-care-leave/create-family-care-leave"
import { GetFamilyCareLeave } from "@/application/family-care-leave/get-family-care-leave"
import { ListMyFamilyCareLeaves } from "@/application/family-care-leave/list-my-family-care-leaves"
import { UpdateFamilyCareLeave } from "@/application/family-care-leave/update-family-care-leave"
import { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/shared/test/create-test-context"

async function seedLeave(context: Context, employeeId: number): Promise<string> {
  const created = await new CreateFamilyCareLeave(context).run({
    employeeId: employeeId,
    leaveKind: "childcare",
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    note: "育児休業を申し出ます",
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateFamilyCareLeave", () => {
  test("creates a family care leave with status requested", async () => {
    const { context } = createTestContext()

    const created = await new CreateFamilyCareLeave(context).run({
      employeeId: 2,
      leaveKind: "maternity",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(FamilyCareLeave)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("requested")
    expect(created.note).toBe(null)
  })
})

describe("GetFamilyCareLeave", () => {
  test("returns the leave for its applicant", async () => {
    const { context } = createTestContext()

    const leaveId = await seedLeave(context, 5)

    const result = await new GetFamilyCareLeave(context).run({
      familyCareLeaveId: leaveId,
      employeeId: 5,
    })

    expect(result).toBeInstanceOf(FamilyCareLeave)
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const leaveId = await seedLeave(context, 5)

    const result = await new GetFamilyCareLeave(context).run({
      familyCareLeaveId: leaveId,
      employeeId: 6,
    })

    expect(result).toEqual({ reason: "not_applicant" })
  })

  test("returns family_care_leave_not_found for an unknown id", async () => {
    const { context } = createTestContext()

    const result = await new GetFamilyCareLeave(context).run({
      familyCareLeaveId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "family_care_leave_not_found" })
  })
})

describe("ListMyFamilyCareLeaves", () => {
  test("returns only the applicant's leaves", async () => {
    const { context } = createTestContext()

    await seedLeave(context, 5)

    await seedLeave(context, 6)

    const result = await new ListMyFamilyCareLeaves(context).run({ employeeId: 5 })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
    expect(result[0].employeeId).toBe(5)
  })
})

describe("UpdateFamilyCareLeave", () => {
  test("updates the details for the applicant", async () => {
    const { context } = createTestContext()

    const leaveId = await seedLeave(context, 5)

    const result = await new UpdateFamilyCareLeave(context).run({
      familyCareLeaveId: leaveId,
      employeeId: 5,
      leaveKind: "family_care",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      note: "介護のため変更します",
    })

    expect(result).toBeInstanceOf(FamilyCareLeave)

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.leaveKind).toBe("family_care")
    expect(result.note).toBe("介護のため変更します")
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const leaveId = await seedLeave(context, 5)

    const result = await new UpdateFamilyCareLeave(context).run({
      familyCareLeaveId: leaveId,
      employeeId: 6,
      leaveKind: "family_care",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      note: null,
    })

    expect(result).toEqual({ reason: "not_applicant" })
  })
})

describe("CancelFamilyCareLeave", () => {
  test("cancels the leave for the applicant", async () => {
    const { context } = createTestContext()

    const leaveId = await seedLeave(context, 5)

    const result = await new CancelFamilyCareLeave(context).run({
      familyCareLeaveId: leaveId,
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const leaveId = await seedLeave(context, 5)

    const result = await new CancelFamilyCareLeave(context).run({
      familyCareLeaveId: leaveId,
      employeeId: 6,
    })

    expect(result).toEqual({ reason: "not_applicant" })
  })
})
