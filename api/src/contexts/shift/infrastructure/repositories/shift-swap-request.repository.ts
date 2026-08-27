import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ShiftSwapRequest } from "@/contexts/shift/domain/entities/shift-swap-request.entity"
import type { ShiftAssignment } from "@/contexts/shift/domain/entities/shift-assignment.entity"
import type { Context } from "@/env"
import { shiftSwapRequests } from "@/contexts/shift/infrastructure/schema/shift"
import { and, asc, eq, sql } from "drizzle-orm"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"

export type ShiftSwapConflict = { reason: "conflict" }

export class ShiftSwapRequestRepository {
  constructor(private readonly c: Context) {}

  async findById(swapRequestId: number): Promise<ShiftSwapRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftSwapRequests)
        .where(eq(shiftSwapRequests.id, swapRequestId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ShiftSwapRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load shift_swap_request")
    }
  }

  async findPending(
    requesterEmployeeId: EmployeeId,
    targetEmployeeId: EmployeeId,
    date: string,
  ): Promise<ShiftSwapRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftSwapRequests)
        .where(
          and(
            eq(shiftSwapRequests.requesterEmployeeId, requesterEmployeeId),
            eq(shiftSwapRequests.targetEmployeeId, targetEmployeeId),
            eq(shiftSwapRequests.date, date),
            eq(shiftSwapRequests.status, "pending"),
          ),
        )
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ShiftSwapRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to find pending shift_swap_request")
    }
  }

  async findByRequesterId(props: {
    requesterEmployeeId: EmployeeId
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ShiftSwapRequest> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftSwapRequests)
        .where(eq(shiftSwapRequests.requesterEmployeeId, props.requesterEmployeeId))
        .orderBy(asc(shiftSwapRequests.date))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => ShiftSwapRequest.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load shift_swap_requests")
    }
  }

  /**
   * pending 重複がなければ INSERT し、既に pending があれば null を返す。
   * INSERT ... SELECT ... WHERE NOT EXISTS でチェックと挿入をアトミックに行い TOCTOU を防ぐ。
   */
  async create(swapRequest: ShiftSwapRequest): Promise<ShiftSwapRequest | null | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO shift_swap_requests (requester_employee_id, target_employee_id, date, note, status, approved_at)
            SELECT ${swapRequest.requesterEmployeeId}, ${swapRequest.targetEmployeeId},
                   ${swapRequest.date}, ${swapRequest.note}, ${swapRequest.status}, ${swapRequest.approvedAt}
            WHERE NOT EXISTS (
              SELECT 1 FROM shift_swap_requests
              WHERE requester_employee_id = ${swapRequest.requesterEmployeeId}
                AND target_employee_id = ${swapRequest.targetEmployeeId}
                AND date = ${swapRequest.date}
                AND status = 'pending'
            )`,
      )

      if (result.meta.changes === 0) {
        return null
      }

      // last_insert_rowid で採番された行を取得する
      const rows = await this.c.var.database
        .select()
        .from(shiftSwapRequests)
        .where(eq(shiftSwapRequests.id, Number(result.meta.last_row_id)))
        .limit(1)

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to retrieve inserted shift swap request")
        : ShiftSwapRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert shift swap request")
    }
  }

  async update(swapRequest: ShiftSwapRequest): Promise<ShiftSwapRequest | null | Error> {
    try {
      if (swapRequest.id === null) {
        return new Error("cannot update unsaved shift swap request")
      }

      const rows = await this.c.var.database
        .update(shiftSwapRequests)
        .set({ status: swapRequest.status, approvedAt: swapRequest.approvedAt })
        .where(
          and(eq(shiftSwapRequests.id, swapRequest.id), eq(shiftSwapRequests.status, "pending")),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ShiftSwapRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to approve shift swap request")
    }
  }

  async approveWithAssignmentSwap(props: {
    approved: ShiftSwapRequest
    requesterAssignment: ShiftAssignment
    targetAssignment: ShiftAssignment
  }): Promise<ShiftSwapRequest | ShiftSwapConflict | Error> {
    if (
      props.approved.id === null ||
      props.requesterAssignment.id === null ||
      props.targetAssignment.id === null
    ) {
      return new Error("saved swap request and assignments are required")
    }

    try {
      const db = this.c.env.DB
      await db.batch([
        db
          .prepare(
            "UPDATE shift_swap_requests SET status = ?1, approved_at = ?2 WHERE id = ?3 AND status = 'pending'",
          )
          .bind(props.approved.status, props.approved.approvedAt, props.approved.id),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            "UPDATE shift_assignments SET pattern_id = ?1 WHERE id = ?2 AND pattern_id IS ?3",
          )
          .bind(
            props.targetAssignment.patternId,
            props.requesterAssignment.id,
            props.requesterAssignment.patternId,
          ),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            "UPDATE shift_assignments SET pattern_id = ?1 WHERE id = ?2 AND pattern_id IS ?3",
          )
          .bind(
            props.requesterAssignment.patternId,
            props.targetAssignment.id,
            props.targetAssignment.patternId,
          ),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
      return props.approved
    } catch (error) {
      if (isAbortedByGuard(error)) return { reason: "conflict" }
      return error instanceof Error ? error : new Error("failed to swap shift assignments")
    }
  }

  async delete(swapRequestId: number): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(shiftSwapRequests)
        .where(
          and(eq(shiftSwapRequests.id, swapRequestId), eq(shiftSwapRequests.status, "pending")),
        )
        .returning()

      return rows.length === 0 ? null : true
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete shift swap request")
    }
  }
}
