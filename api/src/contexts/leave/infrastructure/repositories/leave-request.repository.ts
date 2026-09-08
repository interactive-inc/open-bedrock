import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import type { Context } from "@/env"
import { leaveRequests } from "@/contexts/leave/infrastructure/schema/leave"
import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm"

export class LeaveRequestRepository {
  constructor(private readonly c: Context) {}

  async findById(leaveRequestId: number): Promise<LeaveRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.id, leaveRequestId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : LeaveRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load leave_request")
    }
  }

  /**
   * 同一社員の未却下（pending/approved）申請のうち、指定期間と重なるものを返す。
   * 期間 [startA, endA] と [startB, endB] は startA <= endB かつ startB <= endA で重複する。
   * 日付は YYYY-MM-DD のゼロ埋め文字列なので辞書順比較で大小が成り立つ。
   * excludeId を渡すと当該申請自身を除外する（更新時に自己ヒットして常に重複扱いになるのを防ぐ）。
   */
  async findOverlapping(props: {
    employeeId: EmployeeId
    startDate: string
    endDate: string
    excludeId?: number
  }): Promise<ReadonlyArray<LeaveRequest> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(leaveRequests)
        .where(
          and(
            eq(leaveRequests.employeeId, props.employeeId),
            inArray(leaveRequests.status, ["pending", "approved"]),
            lte(leaveRequests.startDate, props.endDate),
            gte(leaveRequests.endDate, props.startDate),
            props.excludeId === undefined ? undefined : ne(leaveRequests.id, props.excludeId),
          ),
        )

      return rows.map((row) => LeaveRequest.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to query leave_request overlap")
    }
  }

  /**
   * 重複チェックと INSERT をアトミックに行い TOCTOU 競合を防ぐ。
   * 同一社員の未却下（pending/approved）申請と期間が重なる行があれば INSERT をスキップし null を返す。
   */
  async create(leaveRequest: LeaveRequest): Promise<LeaveRequest | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, unit, hours, consumed_days, reason, status, approver_id, decided_comment, created_at)
            SELECT ${leaveRequest.employeeId}, ${leaveRequest.leaveType},
                   ${leaveRequest.startDate}, ${leaveRequest.endDate},
                   ${leaveRequest.days}, ${leaveRequest.unit}, ${leaveRequest.hours},
                   ${leaveRequest.consumedDays},
                   ${leaveRequest.reason},
                   ${leaveRequest.status}, ${leaveRequest.approverId},
                   ${leaveRequest.decidedComment}, ${leaveRequest.createdAt}
            WHERE NOT EXISTS (
              SELECT 1 FROM leave_requests
              WHERE employee_id = ${leaveRequest.employeeId}
                AND status IN ('pending', 'approved')
                AND start_date <= ${leaveRequest.endDate}
                AND end_date >= ${leaveRequest.startDate}
            )`,
      )

      if (result.meta.changes === 0) {
        return null
      }

      const rows = await this.c.var.database
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.id, Number(result.meta.last_row_id)))
        .limit(1)

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to retrieve inserted leave_request")
        : LeaveRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert leave_request")
    }
  }

  /**
   * 申請内容（種別・期間・日数・理由）を更新する。未保存は不可。
   * pending 状態のみ更新可かつ重複なしの条件で UPDATE する（TOCTOU 競合を防ぐ）。
   * 0 行更新の場合は status を再確認し "already_decided" か "overlapping" を返す。
   */
  async revise(
    leaveRequest: LeaveRequest,
  ): Promise<LeaveRequest | "already_decided" | "overlapping" | Error> {
    try {
      if (leaveRequest.id === null) {
        return new Error("cannot revise unsaved leave request")
      }

      const result = await this.c.var.database.run(
        sql`UPDATE leave_requests
            SET leave_type    = ${leaveRequest.leaveType},
                start_date    = ${leaveRequest.startDate},
                end_date      = ${leaveRequest.endDate},
                days          = ${leaveRequest.days},
                unit          = ${leaveRequest.unit},
                hours         = ${leaveRequest.hours},
                consumed_days = ${leaveRequest.consumedDays},
                reason        = ${leaveRequest.reason}
            WHERE id = ${leaveRequest.id}
              AND status = 'pending'
              AND NOT EXISTS (
                SELECT 1 FROM leave_requests
                WHERE employee_id = ${leaveRequest.employeeId}
                  AND status IN ('pending', 'approved')
                  AND id != ${leaveRequest.id}
                  AND start_date <= ${leaveRequest.endDate}
                  AND end_date >= ${leaveRequest.startDate}
              )`,
      )

      if (result.meta.changes === 0) {
        // 0 行更新: status が pending でないか、重複があるかを区別する。
        const current = await this.findById(leaveRequest.id)

        if (current instanceof Error) {
          return current
        }

        if (current === null || current.status !== "pending") {
          return "already_decided"
        }

        return "overlapping"
      }

      const rows = await this.c.var.database
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.id, leaveRequest.id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to retrieve revised leave_request")
        : LeaveRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to revise leave_request")
    }
  }

  /**
   * 休暇申請を削除する。
   * pending 状態のみ削除可。承認済み・却下済みは 0 行削除となり null を返す（TOCTOU 競合を防ぐ）。
   */
  async delete(leaveRequestId: number): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(leaveRequests)
        .where(and(eq(leaveRequests.id, leaveRequestId), eq(leaveRequests.status, "pending")))
        .returning({ id: leaveRequests.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete leave_request")
    }
  }
}
