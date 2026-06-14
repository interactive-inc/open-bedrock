import { LeaveRequest } from "@/domain/leave/leave-request.entity"
import type { Context } from "@/env"
import { leaveBalances, leaveRequests } from "@/schema"
import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm"

export type ApproveWithBalanceOutcome =
  | LeaveRequest
  | "already_decided"
  | "balance_not_found"
  | "insufficient_balance"
  | Error

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
  // excludeId を渡すと当該申請自身を除外する（更新時に自己ヒットして常に重複扱いになるのを防ぐ）。
  async findOverlapping(props: {
    employeeId: number
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

  // 重複チェックと INSERT をアトミックに行い TOCTOU 競合を防ぐ。
  // 同一社員の未却下（pending/approved）申請と期間が重なる行があれば INSERT をスキップし null を返す。
  async create(leaveRequest: LeaveRequest): Promise<LeaveRequest | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status, approver_id, decided_comment, created_at)
            SELECT ${leaveRequest.employeeId}, ${leaveRequest.leaveType},
                   ${leaveRequest.startDate}, ${leaveRequest.endDate},
                   ${leaveRequest.days}, ${leaveRequest.reason},
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

  // 承認と休暇残数の減算を D1 batch で同一トランザクションにまとめる。
  // Cloudflare D1 は BEGIN TRANSACTION ではなく batch() で複数 statement の
  // 順次実行と失敗時 rollback を提供する。
  async approveFromPendingAndConsumeBalance(props: {
    leaveRequestId: number
    approverId: number
    decidedComment: string | null
    fiscalYear: string
  }): Promise<ApproveWithBalanceOutcome> {
    try {
      let batchError: Error | null = null
      let decideResult: D1Result<unknown> | undefined

      try {
        const results = await this.c.env.DB.batch([
          this.c.env.DB.prepare(
            `
            UPDATE leave_balances
            SET
              used_days = used_days + COALESCE(
                (SELECT days FROM leave_requests WHERE id = ?1 AND status = 'pending'),
                0
              ),
              remaining_days = remaining_days - COALESCE(
                (SELECT days FROM leave_requests WHERE id = ?1 AND status = 'pending'),
                0
              )
            WHERE employee_id = (
                SELECT employee_id FROM leave_requests WHERE id = ?1 AND status = 'pending'
              )
              AND leave_type = (
                SELECT leave_type FROM leave_requests WHERE id = ?1 AND status = 'pending'
              )
              AND fiscal_year = ?2
              AND remaining_days >= COALESCE(
                (SELECT days FROM leave_requests WHERE id = ?1 AND status = 'pending'),
                0
              )
            `,
          ).bind(props.leaveRequestId, props.fiscalYear),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
          this.c.env.DB.prepare(
            `
            UPDATE leave_requests
            SET
              status = 'approved',
              approver_id = ?2,
              decided_comment = ?3
            WHERE id = ?1
              AND status = 'pending'
            RETURNING
              id,
              employee_id AS employeeId,
              leave_type AS leaveType,
              start_date AS startDate,
              end_date AS endDate,
              days,
              reason,
              status,
              approver_id AS approverId,
              decided_comment AS decidedComment,
              created_at AS createdAt
            `,
          ).bind(props.leaveRequestId, props.approverId, props.decidedComment),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ])

        decideResult = results.at(2)
      } catch (error) {
        batchError = error instanceof Error ? error : new Error("failed to approve leave_request")
      }

      const decidedRow = firstResultRow(decideResult)

      if (decidedRow !== undefined) {
        return LeaveRequest.fromRow(decidedRow as Parameters<typeof LeaveRequest.fromRow>[0])
      }

      const current = await this.findById(props.leaveRequestId)

      if (current instanceof Error) {
        return current
      }

      if (current === null || current.status !== "pending") {
        return "already_decided"
      }

      const balanceRows = await this.c.var.database
        .select()
        .from(leaveBalances)
        .where(
          and(
            eq(leaveBalances.employeeId, current.employeeId),
            eq(leaveBalances.leaveType, current.leaveType),
            eq(leaveBalances.fiscalYear, props.fiscalYear),
          ),
        )
        .limit(1)

      if (balanceRows.at(0) === undefined) {
        return "balance_not_found"
      }

      const balance = balanceRows.at(0)

      if (balance !== undefined && balance.remainingDays < current.days) {
        return "insufficient_balance"
      }

      return batchError ?? new Error("failed to approve leave_request")
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to approve leave_request")
    }
  }

  // 申請内容（種別・期間・日数・理由）を更新する。未保存は不可。
  // pending 状態のみ更新可かつ重複なしの条件で UPDATE する（TOCTOU 競合を防ぐ）。
  // 0 行更新の場合は status を再確認し "already_decided" か "overlapping" を返す。
  async revise(
    leaveRequest: LeaveRequest,
  ): Promise<LeaveRequest | "already_decided" | "overlapping" | Error> {
    try {
      if (leaveRequest.id === null) {
        return new Error("cannot revise unsaved leave request")
      }

      const result = await this.c.var.database.run(
        sql`UPDATE leave_requests
            SET leave_type = ${leaveRequest.leaveType},
                start_date = ${leaveRequest.startDate},
                end_date   = ${leaveRequest.endDate},
                days       = ${leaveRequest.days},
                reason     = ${leaveRequest.reason}
            WHERE id = ${leaveRequest.id}
              AND status = 'pending'
              AND NOT EXISTS (
                SELECT 1 FROM leave_requests
                WHERE employee_id = ${leaveRequest.employeeId}
                  AND status IN ('pending', 'approved')
                  AND id != ${leaveRequest.id}
                  AND start_date < ${leaveRequest.endDate}
                  AND end_date > ${leaveRequest.startDate}
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

  // 休暇申請を削除する。
  // pending 状態のみ削除可。承認済み・却下済みは 0 行削除となり null を返す（TOCTOU 競合を防ぐ）。
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

function firstResultRow(result: D1Result<unknown> | undefined): unknown {
  return result?.results?.at(0)
}

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}
