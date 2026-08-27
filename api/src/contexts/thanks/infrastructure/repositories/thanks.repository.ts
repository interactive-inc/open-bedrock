import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { Thanks, thanksRowSchema } from "@/contexts/thanks/domain/entities/thanks.entity"
import type { Context } from "@/env"
import { thanks } from "@/contexts/thanks/infrastructure/schema/thanks"
import { desc, eq } from "drizzle-orm"
import { parseD1Row } from "@/lib/d1/parse-d1-row"

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

  async consumeBudgetAndCreate(props: {
    thanksRecord: Thanks
    period: string
  }): Promise<Thanks | null | Error> {
    try {
      const db = this.c.env.DB
      const insert = db
        .prepare(
          props.thanksRecord.points === 0
            ? "INSERT INTO thanks_messages (sender_employee_id, recipient_employee_id, message, points, created_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id, sender_employee_id AS senderEmployeeId, recipient_employee_id AS recipientEmployeeId, message, points, created_at AS createdAt"
            : "INSERT INTO thanks_messages (sender_employee_id, recipient_employee_id, message, points, created_at) SELECT ?1, ?2, ?3, ?4, ?5 WHERE changes() > 0 RETURNING id, sender_employee_id AS senderEmployeeId, recipient_employee_id AS recipientEmployeeId, message, points, created_at AS createdAt",
        )
        .bind(
          props.thanksRecord.senderEmployeeId,
          props.thanksRecord.recipientEmployeeId,
          props.thanksRecord.message,
          props.thanksRecord.points,
          props.thanksRecord.createdAt,
        )

      const results =
        props.thanksRecord.points === 0
          ? await db.batch([insert])
          : await db.batch([
              db
                .prepare(
                  "UPDATE thanks_point_budgets SET consumed_points = consumed_points + ?1 WHERE employee_id = ?2 AND period = ?3 AND granted_points - consumed_points >= ?1",
                )
                .bind(props.thanksRecord.points, props.thanksRecord.senderEmployeeId, props.period),
              insert,
            ])

      const insertResult = results.at(-1)
      if (insertResult === undefined || insertResult.results.length === 0) return null

      const row = parseD1Row(insertResult, thanksRowSchema)
      if (row instanceof Error) return row
      return row === undefined ? new Error("failed to insert thanks") : Thanks.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to send thanks")
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
    senderEmployeeId: EmployeeId
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
