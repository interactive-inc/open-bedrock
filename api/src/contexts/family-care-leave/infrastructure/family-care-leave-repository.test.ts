import { FamilyCareLeave } from "@/contexts/family-care-leave/domain/family-care-leave.entity"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/family-care-leave-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { familyCareLeaves } from "@/contexts/family-care-leave/infrastructure/schema/family-care-leave"
import { describe, expect, test } from "bun:test"

describe("FamilyCareLeaveRepository", () => {
  /** 新規の休業申出ドメインを組み立てる。invalid_date_range は致命なので throw する。 */
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

  describe("updateIfNoOverlap", () => {
    test("returns null when the new period overlaps another requested leave of the same employee", async () => {
      const { context } = createTestContext()

      const repository = new FamilyCareLeaveRepository(context)

      const a = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-01", endDate: "2026-02-05" }),
      )

      const b = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-10", endDate: "2026-02-15" }),
      )

      if (a instanceof Error || a === null || b instanceof Error || b === null) {
        throw new Error("setup create failed")
      }

      // b を a と重なる期間へ変更しようとすると重複で null。
      const conflicting = b.withDetails({
        leaveKind: "family_care",
        startDate: "2026-02-04",
        endDate: "2026-02-08",
        note: null,
      })

      if ("reason" in conflicting) {
        throw new Error("unexpected invalid_date_range")
      }

      const result = await repository.updateIfNoOverlap(conflicting)

      expect(result).toBeNull()
    })

    test("succeeds when only the leave itself overlaps (self-exclusion)", async () => {
      const { context } = createTestContext()

      const repository = new FamilyCareLeaveRepository(context)

      const leave = await repository.create(
        buildLeave({ employeeId: 1, startDate: "2026-02-01", endDate: "2026-02-05" }),
      )

      if (leave instanceof Error || leave === null) {
        throw new Error("setup create failed")
      }

      // 自身としか重ならない変更は自身を除外するため成功する。
      const changed = leave.withDetails({
        leaveKind: "family_care",
        startDate: "2026-02-03",
        endDate: "2026-02-08",
        note: null,
      })

      if ("reason" in changed) {
        throw new Error("unexpected invalid_date_range")
      }

      const result = await repository.updateIfNoOverlap(changed)

      expect(result).toBeInstanceOf(FamilyCareLeave)

      if (result instanceof Error || result === null) {
        throw new Error("expected leave but got null or Error")
      }

      const found = await repository.findById(leave.id)

      expect(found).toBeInstanceOf(FamilyCareLeave)

      if (found instanceof Error || found === null) {
        throw new Error("findById failed")
      }

      expect(found.startDate).toBe("2026-02-03")
      expect(found.endDate).toBe("2026-02-08")
    })

    test("returns null when the target row is not in requested status", async () => {
      const { context } = createTestContext()

      const repository = new FamilyCareLeaveRepository(context)

      // status が requested 以外（approved）の行はドメインで作れないため直接挿入する。
      await context.var.database.insert(familyCareLeaves).values({
        id: "00000000-0000-0000-0000-0000000000bb",
        employeeId: 1,
        leaveKind: "family_care",
        startDate: "2026-02-01",
        endDate: "2026-02-05",
        note: null,
        status: "approved",
        createdAt: "2026-01-01T00:00:00.000Z",
      })

      const target = new FamilyCareLeave({
        id: "00000000-0000-0000-0000-0000000000bb",
        employeeId: 1,
        leaveKind: "family_care",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        note: null,
        status: "requested",
        createdAt: "2026-01-01T00:00:00.000Z",
      })

      const result = await repository.updateIfNoOverlap(target)

      expect(result).toBeNull()
    })
  })
})
