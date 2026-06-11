import { Resignation } from "@/domain/resignation/resignation"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { resignations } from "@/schema"
import { and, asc, eq } from "drizzle-orm"

export type AlreadyRequestedError = { kind: "already_requested" }

export class ResignationRepository {
  constructor(private readonly c: Context) {}

  // 申請者本人の退職申請を退職希望日の昇順でページングして返す。
  async findByEmployeeId(props: {
    employeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Resignation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(resignations)
        .where(eq(resignations.employeeId, props.employeeId))
        .orderBy(asc(resignations.resignationDate))
        .limit(props.limit)
        .offset(props.offset)

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

  // 指定社員の PENDING（requested）状態の退職申請を1件返す。存在しなければ null。
  async findPendingByEmployeeId(employeeId: number): Promise<Resignation | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(resignations)
        .where(and(eq(resignations.employeeId, employeeId), eq(resignations.status, "requested")))

      const row = rows.at(0)

      return row === undefined ? null : Resignation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to find pending resignation")
    }
  }

  // UNIQUE 制約 (employee_id) WHERE status = 'requested' に違反した場合は already_requested を返す。
  async create(resignation: Resignation): Promise<Resignation | AlreadyRequestedError | Error> {
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
      if (isUniqueConstraintError(error)) {
        return { kind: "already_requested" }
      }
      return error instanceof Error ? error : new Error("failed to save resignation")
    }
  }

  // 退職申請の退職希望日・最終出社日・理由を更新する。status が "requested" の行のみ対象。
  async update(resignation: Resignation): Promise<Resignation | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(resignations)
        .set({
          resignationDate: resignation.resignationDate,
          lastWorkingDate: resignation.lastWorkingDate,
          reason: resignation.reason,
        })
        .where(
          and(
            eq(resignations.id, resignation.id),
            eq(resignations.status, "requested"),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Resignation.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update resignation")
    }
  }

  // 退職申請を削除する。status が "requested" の行のみ対象。
  async delete(id: string): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(resignations)
        .where(
          and(
            eq(resignations.id, id),
            eq(resignations.status, "requested"),
          ),
        )
        .returning({ id: resignations.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete resignation")
    }
  }
}
