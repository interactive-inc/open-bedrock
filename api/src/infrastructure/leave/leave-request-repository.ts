import { LeaveRequest } from "@/domain/leave/leave-request"
import type { Context } from "@/env"
import { leaveRequests } from "@/schema"
import { eq } from "drizzle-orm"

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
