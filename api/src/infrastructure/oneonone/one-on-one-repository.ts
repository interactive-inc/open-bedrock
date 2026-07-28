import { OneOnOne } from "@/domain/oneonone/one-on-one.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { oneOnOnes } from "@/schema"
import { desc, eq, or } from "drizzle-orm"

export class OneOnOneRepository {
  constructor(private readonly c: Context) {}

  /** 1on1 id で1件取得する。存在しなければ null。 */
  async findById(id: string): Promise<OneOnOne | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(oneOnOnes)
        .where(eq(oneOnOnes.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : OneOnOne.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load one_on_one")
    }
  }

  /** 本人が参加した（メンバー or マネージャー）1on1 を開催日時の降順で返す。 */
  async findByParticipantId(
    employeeId: number,
    options: { limit: number; offset: number },
  ): Promise<ReadonlyArray<OneOnOne> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(oneOnOnes)
        .where(or(eq(oneOnOnes.memberId, employeeId), eq(oneOnOnes.managerId, employeeId)))
        .orderBy(desc(oneOnOnes.heldAt))
        .limit(options.limit)
        .offset(options.offset)

      return rows.map((row) => OneOnOne.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load one_on_ones")
    }
  }

  async save(oneOnOne: OneOnOne): Promise<OneOnOne | Error> {
    try {
      await this.c.var.database.insert(oneOnOnes).values({
        id: oneOnOne.id,
        memberId: oneOnOne.memberId,
        managerId: oneOnOne.managerId,
        heldAt: oneOnOne.heldAt,
        topics: oneOnOne.topics,
        managerNote: oneOnOne.managerNote,
        nextAction: oneOnOne.nextAction,
      })

      return oneOnOne
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("one_on_one already exists", { cause: error })
      }
      return error instanceof Error ? error : new Error("failed to save one_on_one")
    }
  }

  /**
   * 記録内容（議題・上長メモ・次のアクション）を更新する。
   * 対象行が存在しない場合は null を返す。
   */
  async update(oneOnOne: OneOnOne): Promise<OneOnOne | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(oneOnOnes)
        .set({
          topics: oneOnOne.topics,
          managerNote: oneOnOne.managerNote,
          nextAction: oneOnOne.nextAction,
        })
        .where(eq(oneOnOnes.id, oneOnOne.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : OneOnOne.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update one_on_one")
    }
  }

  /** 1on1 の記録を削除する。対象行が存在しない場合は null を返す。 */
  async delete(id: string): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(oneOnOnes)
        .where(eq(oneOnOnes.id, id))
        .returning({ id: oneOnOnes.id })

      return rows.length === 0 ? null : true
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete one_on_one")
    }
  }
}
