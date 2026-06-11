import { FamilyCareLeave } from "@/domain/family-care-leave/family-care-leave"
import type { Context } from "@/env"
import { familyCareLeaves } from "@/schema"
import { and, asc, eq } from "drizzle-orm"

export class FamilyCareLeaveRepository {
  constructor(private readonly c: Context) {}

  // 申出者本人の休業申出を開始日の昇順で返す。
  async findByEmployeeId(employeeId: number): Promise<ReadonlyArray<FamilyCareLeave> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(familyCareLeaves)
        .where(eq(familyCareLeaves.employeeId, employeeId))
        .orderBy(asc(familyCareLeaves.startDate))

      return rows.map((row) => FamilyCareLeave.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load family_care_leaves")
    }
  }

  // 休業申出 id で1件取得する。存在しなければ null。
  async findById(id: string): Promise<FamilyCareLeave | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(familyCareLeaves)
        .where(eq(familyCareLeaves.id, id))

      const row = rows.at(0)

      return row === undefined ? null : FamilyCareLeave.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load family_care_leave")
    }
  }

  async create(familyCareLeave: FamilyCareLeave): Promise<FamilyCareLeave | Error> {
    try {
      await this.c.var.database.insert(familyCareLeaves).values({
        id: familyCareLeave.id,
        employeeId: familyCareLeave.employeeId,
        leaveKind: familyCareLeave.leaveKind,
        startDate: familyCareLeave.startDate,
        endDate: familyCareLeave.endDate,
        note: familyCareLeave.note,
        status: familyCareLeave.status,
        createdAt: familyCareLeave.createdAt,
      })

      return familyCareLeave
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save family_care_leave")
    }
  }

  // 休業申出の種別・期間・備考を更新する。status が requested のときのみ更新し、0 行更新は null を返す。
  async update(familyCareLeave: FamilyCareLeave): Promise<FamilyCareLeave | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(familyCareLeaves)
        .set({
          leaveKind: familyCareLeave.leaveKind,
          startDate: familyCareLeave.startDate,
          endDate: familyCareLeave.endDate,
          note: familyCareLeave.note,
        })
        .where(
          and(
            eq(familyCareLeaves.id, familyCareLeave.id),
            eq(familyCareLeaves.status, "requested"),
          ),
        )
        .returning()

      return rows.length === 0 ? null : familyCareLeave
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update family_care_leave")
    }
  }

  // 休業申出を削除する。
  async delete(id: string): Promise<null | Error> {
    try {
      await this.c.var.database.delete(familyCareLeaves).where(eq(familyCareLeaves.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete family_care_leave")
    }
  }
}
