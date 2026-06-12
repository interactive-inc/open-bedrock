import { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave"
import { FamilyCareLeaveRepository } from "@/infrastructure/family-care-leave/family-care-leave-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { familyCareLeaves } from "@/schema"
import { describe, expect, test } from "bun:test"

describe("FamilyCareLeaveRepository", () => {
  // 新規の休業申出ドメインを組み立てる。invalid_date_range は致命なので throw する。
  function buildLeave(props: {
    employeeId: number
    startDate: string
    endDate: string
  }): FamilyCareLeave {
    const leave = FamilyCareLeave.create({
      employeeId: props.employeeId,
      leaveKind: "family_care",
      startDate: props.startDate,
      endDate: props.endDate,
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if ("reason" in leave) {
      throw new Error("failed to build family care leave")
    }

    return leave
  }

  describe("create", () => {
    test("creates a leave when there is no overlap", async () => {
      const { context } = createTestContext()

      const repository = new FamilyCareLeaveRepository(context)

      const created = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-01", endDate: "2026-02-05" }),
      )

      expect(created).toBeInstanceOf(FamilyCareLeave)

      if (created instanceof Error || created === null) {
        throw new Error("create failed")
      }

      const found = await repository.findById(created.id)

      expect(found).toBeInstanceOf(FamilyCareLeave)
    })

    test("returns null when an overlapping requested leave already exists for the same employee", async () => {
      const { context } = createTestContext()

      const repository = new FamilyCareLeaveRepository(context)

      const first = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-01", endDate: "2026-02-05" }),
      )

      if (first instanceof Error || first === null) {
        throw new Error("first create failed")
      }

      const second = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-03", endDate: "2026-02-07" }),
      )

      expect(second).toBeNull()
    })

    test("creates a leave for another employee even with the same period", async () => {
      const { context } = createTestContext()

      const repository = new FamilyCareLeaveRepository(context)

      const first = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-01", endDate: "2026-02-05" }),
      )

      if (first instanceof Error || first === null) {
        throw new Error("first create failed")
      }

      const second = await repository.create(
        buildLeave({ employeeId: 2, startDate: "2026-02-01", endDate: "2026-02-05" }),
      )

      expect(second).toBeInstanceOf(FamilyCareLeave)
    })

    test("creates a leave when the only overlapping row is not in requested status", async () => {
      const { context } = createTestContext()

      const repository = new FamilyCareLeaveRepository(context)

      // status が requested 以外（approved）の行はドメインで作れないため直接挿入する。
      await context.var.database.insert(familyCareLeaves).values({
        id: "00000000-0000-0000-0000-0000000000aa",
        employeeId: 1,
        leaveKind: "family_care",
        startDate: "2026-02-01",
        endDate: "2026-02-05",
        note: null,
        status: "approved",
        createdAt: "2026-01-01T00:00:00.000Z",
      })

      const created = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-03", endDate: "2026-02-07" }),
      )

      expect(created).toBeInstanceOf(FamilyCareLeave)
    })

    test("treats a shared boundary date (existing end_date == new start_date) as an overlap", async () => {
      const { context } = createTestContext()

      const repository = new FamilyCareLeaveRepository(context)

      const first = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-01", endDate: "2026-02-03" }),
      )

      if (first instanceof Error || first === null) {
        throw new Error("first create failed")
      }

      const second = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-03", endDate: "2026-02-05" }),
      )

      expect(second).toBeNull()
    })
  })
})
