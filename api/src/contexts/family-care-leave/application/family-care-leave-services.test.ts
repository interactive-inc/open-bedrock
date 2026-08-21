import { describe, expect, test } from "bun:test"
import { CreateFamilyCareLeave } from "@/contexts/family-care-leave/application/create-family-care-leave"
import { UpdateFamilyCareLeave } from "@/contexts/family-care-leave/application/update-family-care-leave"
import { FamilyCareLeave } from "@/contexts/family-care-leave/domain/family-care-leave.entity"
import type { Context } from "@/env"
import { ApplicationError, ConflictError, ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { createTestContext } from "@/api/test/support/create-test-context"

async function seedLeave(context: Context, employeeId: number): Promise<string> {
  const created = await new CreateFamilyCareLeave(context).run({
    employeeId: employeeId,
    leaveKind: "childcare",
    startDate: "2026-10-01",
    endDate: "2027-03-31",
    note: "育児休業を申し出ます",
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof ApplicationError) {
    throw new Error("seed failed: " + created.code)
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

    if (created instanceof ApplicationError) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("requested")
    expect(created.note).toBe(null)
  })
})

describe("GetFamilyCareLeave", () => {})

describe("ListMyFamilyCareLeaves", () => {})

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

    if (result instanceof ApplicationError) {
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

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })

  test("rejects an update that overlaps another own leave with overlapping_leave", async () => {
    const { context } = createTestContext()

    // employee 5 の既存申出（2026-10-01〜2027-03-31）に加えて、重ならない別期間の申出を追加する。
    const leaveId = await seedLeave(context, 5)

    const other = await new CreateFamilyCareLeave(context).run({
      employeeId: 5,
      leaveKind: "family_care",
      startDate: "2027-05-01",
      endDate: "2027-05-31",
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (other instanceof ApplicationError) {
      throw new Error("seed second leave failed")
    }

    // 1件目を2件目（2027-05-01〜2027-05-31）と重なる期間へ変更しようとすると重複。
    const result = await new UpdateFamilyCareLeave(context).run({
      familyCareLeaveId: leaveId,
      employeeId: 5,
      leaveKind: "childcare",
      startDate: "2027-05-10",
      endDate: "2027-05-20",
      note: null,
    })

    expectApplicationError(result, ConflictError, "overlapping_leave")
  })

  test("allows an update that only overlaps the leave itself (self-exclusion)", async () => {
    const { context } = createTestContext()

    const leaveId = await seedLeave(context, 5)

    // 自身としか重ならない期間変更は自己除外により成功する。
    const result = await new UpdateFamilyCareLeave(context).run({
      familyCareLeaveId: leaveId,
      employeeId: 5,
      leaveKind: "childcare",
      startDate: "2026-10-15",
      endDate: "2027-02-28",
      note: null,
    })

    expect(result).toBeInstanceOf(FamilyCareLeave)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.startDate).toBe("2026-10-15")
    expect(result.endDate).toBe("2027-02-28")
  })
})

describe("CancelFamilyCareLeave", () => {})
