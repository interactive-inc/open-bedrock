import { Resignation } from "@/domain/resignation/resignation"
import type { Context } from "@/env"
import { resignations } from "@/schema"
import { asc, eq } from "drizzle-orm"

export class ResignationRepository {
  constructor(private readonly c: Context) {}

  // 申請者本人の退職申請を退職希望日の昇順で返す。
  async findByEmployeeId(employeeId: number): Promise<ReadonlyArray<Resignation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(resignations)
        .where(eq(resignations.employeeId, employeeId))
        .orderBy(asc(resignations.resignationDate))

      return rows.map((row) => Resignation.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load resignations")
    }
  }

  // 退職申請 id で1件取得する。存在しなければ null。
  async findById(id: string): Promise<Resignation | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(resignations)
        .where(eq(resignations.id, id))

      const row = rows.at(0)

      return row === undefined ? null : Resignation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load resignation")
    }
  }

  async create(resignation: Resignation): Promise<Resignation | Error> {
    try {
      await this.c.var.database.insert(resignations).values({
        id: resignation.id,
        employeeId: resignation.employeeId,
        resignationDate: resignation.resignationDate,
        lastWorkingDate: resignation.lastWorkingDate,
        reason: resignation.reason,
        status: resignation.status,
        createdAt: resignation.createdAt,
      })

      return resignation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save resignation")
    }
  }

  // 退職申請の退職希望日・最終出社日・理由を更新する。
  async update(resignation: Resignation): Promise<Resignation | Error> {
    try {
      await this.c.var.database
        .update(resignations)
        .set({
          resignationDate: resignation.resignationDate,
          lastWorkingDate: resignation.lastWorkingDate,
          reason: resignation.reason,
        })
        .where(eq(resignations.id, resignation.id))

      return resignation
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update resignation")
    }
  }

  // 退職申請を削除する。
  async delete(id: string): Promise<null | Error> {
    try {
      await this.c.var.database.delete(resignations).where(eq(resignations.id, id))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete resignation")
    }
  }
}
