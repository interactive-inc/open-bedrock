import { LeaveRequest } from "@/domain/leave/leave-request"
import type { Context } from "@/env"
import { leaveRequests } from "@/schema"
import { and, eq, gte, inArray, lte } from "drizzle-orm"

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

  // 同一社員の未却下（pending/approved）申請のうち、指定期間と重なるものを返す。
  // 期間 [startA, endA] と [startB, endB] は startA <= endB かつ startB <= endA で重複する。
  // 日付は YYYY-MM-DD のゼロ埋め文字列なので辞書順比較で大小が成り立つ。
  async findOverlapping(props: {
    employeeId: number
    startDate: string
    endDate: string
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
          ),
        )

      return rows.map((row) => LeaveRequest.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to query leave_request overlap")
    }
  }

  async create(leaveRequest: LeaveRequest): Promise<LeaveRequest | Error> {
    try {
      const rows = await this.c.var.database
        .insert(leaveRequests)
        .values({
          employeeId: leaveRequest.employeeId,
          leaveType: leaveRequest.leaveType,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          days: leaveRequest.days,
          reason: leaveRequest.reason,
          status: leaveRequest.status,
          approverId: leaveRequest.approverId,
          decidedComment: leaveRequest.decidedComment,
          createdAt: leaveRequest.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert leave_request")
        : LeaveRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert leave_request")
    }
  }

  async update(leaveRequest: LeaveRequest): Promise<LeaveRequest | null | Error> {
    try {
      if (leaveRequest.id === null) {
        return new Error("cannot update unsaved leave request")
      }

      const rows = await this.c.var.database
        .update(leaveRequests)
        .set({
          status: leaveRequest.status,
          approverId: leaveRequest.approverId,
          decidedComment: leaveRequest.decidedComment,
        })
        .where(eq(leaveRequests.id, leaveRequest.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : LeaveRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update leave_request")
    }
  }

  // 承認/却下を pending からの条件付き UPDATE で確定する。決定済みは 0 行更新となり null を返す。
  // 再決定と残数の二重減算を防ぐ冪等性ガード（TOCTOU 競合にも強い）。
  async decideFromPending(props: {
    leaveRequestId: number
    status: "approved" | "rejected"
    approverId: number
    decidedComment: string | null
  }): Promise<LeaveRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(leaveRequests)
        .set({
          status: props.status,
          approverId: props.approverId,
          decidedComment: props.decidedComment,
        })
        .where(and(eq(leaveRequests.id, props.leaveRequestId), eq(leaveRequests.status, "pending")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : LeaveRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to decide leave_request")
    }
  }

  // 申請内容（種別・期間・日数・理由）を更新する。未保存は不可。
  async revise(leaveRequest: LeaveRequest): Promise<LeaveRequest | null | Error> {
    try {
      if (leaveRequest.id === null) {
        return new Error("cannot revise unsaved leave request")
      }

      const rows = await this.c.var.database
        .update(leaveRequests)
        .set({
          leaveType: leaveRequest.leaveType,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          days: leaveRequest.days,
          reason: leaveRequest.reason,
        })
        .where(eq(leaveRequests.id, leaveRequest.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : LeaveRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to revise leave_request")
    }
  }

  // 休暇申請を削除する。
  async delete(leaveRequestId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(leaveRequests).where(eq(leaveRequests.id, leaveRequestId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete leave_request")
    }
  }
}
