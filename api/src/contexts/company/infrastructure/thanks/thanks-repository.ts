import { Thanks } from "@/contexts/company/domain/thanks/thanks.entity"
import type { Context } from "@/env"
import { thanks } from "@/schema"
import { desc, eq } from "drizzle-orm"

export class ThanksRepository {
  constructor(private readonly c: Context) {}

  /** 感謝を1件保存し、採番済みの集約を返す。 */
  async create(thanksRecord: Thanks): Promise<Thanks | Error> {
    try {
      const rows = await this.c.var.database
        .insert(thanks)
        .values({
          senderEmployeeId: thanksRecord.senderEmployeeId,
          recipientEmployeeId: thanksRecord.recipientEmployeeId,
          message: thanksRecord.message,
          points: thanksRecord.points,
          createdAt: thanksRecord.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert thanks") : Thanks.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert thanks")
    }
  }

  /** 全員に公開される感謝一覧を新しい順（同時刻は id 降順）でページング取得する。 */
  async findMany(props: { limit: number; offset: number }): Promise<ReadonlyArray<Thanks> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanks)
        .orderBy(desc(thanks.createdAt), desc(thanks.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => Thanks.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load thanks")
    }
  }

  /** 自分が送った感謝を新しい順（同時刻は id 降順）でページング取得する。 */
  async findBySender(props: {
    senderEmployeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Thanks> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(thanks)
        .where(eq(thanks.senderEmployeeId, props.senderEmployeeId))
        .orderBy(desc(thanks.createdAt), desc(thanks.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => Thanks.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load sent thanks")
    }
  }
}
