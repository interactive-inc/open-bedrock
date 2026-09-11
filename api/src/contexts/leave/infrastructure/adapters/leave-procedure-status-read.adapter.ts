import type { Context } from "@/env"
import { leaveRequests } from "@/contexts/leave/infrastructure/schema/leave"
import { leaveProcedureStatusSchema } from "@/contexts/leave/domain/definitions/leave-procedure.definition"
import { leaveProcedureStatusSql } from "@/contexts/leave/infrastructure/adapters/leave-procedure-status.sql"
import { eq } from "drizzle-orm"

/** 参照権限を確認済みの休暇の案件状態を取得する。 */
export class LeaveProcedureStatusReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(id: number) {
    try {
      const rows = await this.c.var.database
        .select({ status: leaveProcedureStatusSql })
        .from(leaveRequests)
        .where(eq(leaveRequests.id, id))
        .limit(1)
      return leaveProcedureStatusSchema.parse(rows[0]?.status)
    } catch (cause) {
      return new Error("leave status read failed", { cause })
    }
  }
}
