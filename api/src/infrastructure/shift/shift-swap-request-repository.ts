import { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import type { Context } from "@/env"
import { shiftSwapRequests } from "@/schema"
import { and, asc, eq } from "drizzle-orm"

export type AlreadyExistsError = { reason: "already_exists" }

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
    requesterEmployeeId: number,
    targetEmployeeId: number,
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

  async findByRequesterId(
    requesterEmployeeId: number,
  ): Promise<ReadonlyArray<ShiftSwapRequest> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftSwapRequests)
        .where(eq(shiftSwapRequests.requesterEmployeeId, requesterEmployeeId))
        .orderBy(asc(shiftSwapRequests.date))

      return rows.map((row) => ShiftSwapRequest.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load shift_swap_requests")
    }
  }

  async create(
    swapRequest: ShiftSwapRequest,
  ): Promise<ShiftSwapRequest | AlreadyExistsError | Error> {
    try {
      const rows = await this.c.var.database
        .insert(shiftSwapRequests)
        .values({
          requesterEmployeeId: swapRequest.requesterEmployeeId,
          targetEmployeeId: swapRequest.targetEmployeeId,
          date: swapRequest.date,
          note: swapRequest.note,
          status: swapRequest.status,
          approvedAt: swapRequest.approvedAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert shift swap request")
        : ShiftSwapRequest.fromRow(row)
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return { reason: "already_exists" }
      }
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

  async delete(swapRequestId: number): Promise<null | Error> {
    try {
      await this.c.var.database
        .delete(shiftSwapRequests)
        .where(eq(shiftSwapRequests.id, swapRequestId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete shift swap request")
    }
  }
}
