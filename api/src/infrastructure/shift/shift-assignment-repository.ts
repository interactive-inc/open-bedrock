import { ShiftAssignment } from "@/domain/shift/shift-assignment"
import type { Context } from "@/env"
import { shiftAssignments } from "@/schema"
import { eq } from "drizzle-orm"

export class ShiftAssignmentRepository {
  constructor(private readonly c: Context) {}

  async findById(assignmentId: number): Promise<ShiftAssignment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftAssignments)
        .where(eq(shiftAssignments.id, assignmentId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ShiftAssignment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load shift_assignment")
    }
  }

  async create(assignment: ShiftAssignment): Promise<ShiftAssignment | Error> {
    try {
      const rows = await this.c.var.database
        .insert(shiftAssignments)
        .values({
          employeeId: assignment.employeeId,
          patternId: assignment.patternId,
          date: assignment.date,
          note: assignment.note,
          publishedAt: assignment.publishedAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert shift assignment")
        : ShiftAssignment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert shift assignment")
    }
  }

  async update(assignment: ShiftAssignment): Promise<ShiftAssignment | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(shiftAssignments)
        .set({ publishedAt: assignment.publishedAt })
        .where(eq(shiftAssignments.id, assignment.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ShiftAssignment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to publish shift assignment")
    }
  }
}
