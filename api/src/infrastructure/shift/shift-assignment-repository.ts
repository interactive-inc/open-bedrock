import { ShiftAssignment } from "@/domain/shift/shift-assignment"
import type { Context } from "@/env"
import { shiftAssignments } from "@/schema"
import { asc, eq } from "drizzle-orm"

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

  async findByPatternId(patternId: number): Promise<ReadonlyArray<ShiftAssignment> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftAssignments)
        .where(eq(shiftAssignments.patternId, patternId))

      return rows.map((row) => ShiftAssignment.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load shift_assignments")
    }
  }

  async findByEmployeeId(employeeId: number): Promise<ReadonlyArray<ShiftAssignment> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftAssignments)
        .where(eq(shiftAssignments.employeeId, employeeId))
        .orderBy(asc(shiftAssignments.date))

      return rows.map((row) => ShiftAssignment.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load shift_assignments")
    }
  }

  async update(assignment: ShiftAssignment): Promise<ShiftAssignment | null | Error> {
    try {
      if (assignment.id === null) {
        return new Error("cannot update unsaved shift assignment")
      }

      const rows = await this.c.var.database
        .update(shiftAssignments)
        .set({
          patternId: assignment.patternId,
          date: assignment.date,
          note: assignment.note,
          publishedAt: assignment.publishedAt,
        })
        .where(eq(shiftAssignments.id, assignment.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ShiftAssignment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update shift assignment")
    }
  }

  async delete(assignmentId: number): Promise<null | Error> {
    try {
      await this.c.var.database
        .delete(shiftAssignments)
        .where(eq(shiftAssignments.id, assignmentId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete shift assignment")
    }
  }
}
