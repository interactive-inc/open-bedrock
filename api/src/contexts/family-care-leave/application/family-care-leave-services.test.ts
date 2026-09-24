import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateFamilyCareLeave } from "@/contexts/family-care-leave/application/create-family-care-leave"
import { UpdateFamilyCareLeave } from "@/contexts/family-care-leave/application/update-family-care-leave"
import { FamilyCareLeave } from "@/contexts/family-care-leave/domain/entities/family-care-leave.entity"
import { ApplicationError, ConflictError, ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

function overlaps(left: FamilyCareLeave, right: FamilyCareLeave): boolean {
  return left.startDate <= right.endDate && right.startDate <= left.endDate
}

/**
 * 休業申出のRepositoryを型付きfakeにする。期間重複の判定（同一社員・requested・自身を除外）は
 * Repositoryの条件付き書込みが担うため、fakeは同じ結果（重複なら null）だけを返す。
 * SQLとしての判定は family-care-leave.repository.test.ts が検証する。
 */
function createRepository() {
  const stored = new Map<string, FamilyCareLeave>()

  const conflicting = (leave: FamilyCareLeave) =>
    [...stored.values()].some(
      (other) =>
        other.id !== leave.id &&
        other.employeeId === leave.employeeId &&
        other.status === "requested" &&
        overlaps(other, leave),
    )

  return {
    stored,
    repository: {
      create: async (leave: FamilyCareLeave) => {
        if (conflicting(leave)) return null
        stored.set(leave.id, leave)
        return leave
      },
      findById: async (id: string) => stored.get(id) ?? null,
      updateIfNoOverlap: async (leave: FamilyCareLeave) => {
        if (stored.get(leave.id)?.status !== "requested" || conflicting(leave)) return null
        stored.set(leave.id, leave)
        return leave
      },
    },
  }
}

type Repository = ReturnType<typeof createRepository>["repository"]

async function seedLeave(
  repository: Repository,
  employeeId: number,
  period: { startDate: string; endDate: string } = {
    startDate: "2026-10-01",
    endDate: "2027-03-31",
  },
): Promise<string> {
  const created = await new CreateFamilyCareLeave({ familyCareLeaveRepository: repository }).run({
    employeeId: toWorkforceEmployeeId(employeeId),
    leaveKind: "childcare",
    startDate: period.startDate,
    endDate: period.endDate,
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
    const { repository } = createRepository()

    const created = await new CreateFamilyCareLeave({ familyCareLeaveRepository: repository }).run({
      employeeId: toWorkforceEmployeeId(2),
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

  test("maps a rejected conditional insert to overlapping_leave", async () => {
    const { repository } = createRepository()

    await seedLeave(repository, 5)

    const created = await new CreateFamilyCareLeave({ familyCareLeaveRepository: repository }).run({
      employeeId: toWorkforceEmployeeId(5),
      leaveKind: "family_care",
      startDate: "2026-12-01",
      endDate: "2026-12-31",
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(created, ConflictError, "overlapping_leave")
  })
})

describe("UpdateFamilyCareLeave", () => {
  test("updates the details for the applicant", async () => {
    const { repository } = createRepository()

    const leaveId = await seedLeave(repository, 5)

    const result = await new UpdateFamilyCareLeave({ familyCareLeaveRepository: repository }).run({
      familyCareLeaveId: leaveId,
      employeeId: toWorkforceEmployeeId(5),
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
    const { repository } = createRepository()

    const leaveId = await seedLeave(repository, 5)

    const result = await new UpdateFamilyCareLeave({ familyCareLeaveRepository: repository }).run({
      familyCareLeaveId: leaveId,
      employeeId: toWorkforceEmployeeId(6),
      leaveKind: "family_care",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      note: null,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })

  test("rejects an update that overlaps another own leave with overlapping_leave", async () => {
    const { repository } = createRepository()

    // employee 5 の既存申出（2026-10-01〜2027-03-31）に加えて、重ならない別期間の申出を追加する。
    const leaveId = await seedLeave(repository, 5)

    await seedLeave(repository, 5, { startDate: "2027-05-01", endDate: "2027-05-31" })

    // 1件目を2件目（2027-05-01〜2027-05-31）と重なる期間へ変更しようとすると重複。
    const result = await new UpdateFamilyCareLeave({ familyCareLeaveRepository: repository }).run({
      familyCareLeaveId: leaveId,
      employeeId: toWorkforceEmployeeId(5),
      leaveKind: "childcare",
      startDate: "2027-05-10",
      endDate: "2027-05-20",
      note: null,
    })

    expectApplicationError(result, ConflictError, "overlapping_leave")
  })

  test("allows an update that only overlaps the leave itself (self-exclusion)", async () => {
    const { repository } = createRepository()

    const leaveId = await seedLeave(repository, 5)

    // 自身としか重ならない期間変更は自己除外により成功する。
    const result = await new UpdateFamilyCareLeave({ familyCareLeaveRepository: repository }).run({
      familyCareLeaveId: leaveId,
      employeeId: toWorkforceEmployeeId(5),
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

  test("reports not_modifiable when the leave left requested before the conditional update", async () => {
    const { repository, stored } = createRepository()

    const leaveId = await seedLeave(repository, 5)

    const racing = {
      ...repository,
      // 読込み後に承認され、条件付き更新が0行になった状況を再現する。
      updateIfNoOverlap: async (leave: FamilyCareLeave) => {
        const current = stored.get(leave.id)
        if (current !== undefined) {
          stored.set(leave.id, new FamilyCareLeave({ ...toProps(current), status: "approved" }))
        }
        return null
      },
    }

    const result = await new UpdateFamilyCareLeave({ familyCareLeaveRepository: racing }).run({
      familyCareLeaveId: leaveId,
      employeeId: toWorkforceEmployeeId(5),
      leaveKind: "childcare",
      startDate: "2026-10-15",
      endDate: "2027-02-28",
      note: null,
    })

    expectApplicationError(result, ConflictError, "not_modifiable")
  })
})

function toProps(leave: FamilyCareLeave) {
  return {
    id: leave.id,
    employeeId: leave.employeeId,
    leaveKind: leave.leaveKind,
    startDate: leave.startDate,
    endDate: leave.endDate,
    note: leave.note,
    status: leave.status,
    createdAt: leave.createdAt,
  }
}
