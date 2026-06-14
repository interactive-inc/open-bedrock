import { ShiftAssignment } from "@/domain/shift/shift-assignment.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { shiftAssignments } from "@/schema"
import { and, asc, eq, isNull } from "drizzle-orm"

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

  async findByEmployeeIdAndDate(
    employeeId: number,
    date: string,
  ): Promise<ShiftAssignment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(shiftAssignments)
        .where(and(eq(shiftAssignments.employeeId, employeeId), eq(shiftAssignments.date, date)))
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
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("shift assignment already exists", { cause: error })
      }
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

  async existsByPatternId(patternId: number): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select({ id: shiftAssignments.id })
        .from(shiftAssignments)
        .where(eq(shiftAssignments.patternId, patternId))
        .limit(1)

      return rows.length > 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to check shift_assignments")
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

  // 未公開（published_at IS NULL）の割当のみを公開済みにする。既に公開済みなら 0 行更新で null を返す。
  async markPublished(
    assignmentId: number,
    publishedAt: string,
  ): Promise<ShiftAssignment | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(shiftAssignments)
        .set({ publishedAt })
        .where(and(eq(shiftAssignments.id, assignmentId), isNull(shiftAssignments.publishedAt)))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ShiftAssignment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to publish shift assignment")
    }
  }

  async update(assignment: ShiftAssignment): Promise<ShiftAssignment | null | Error> {
    try {
      if (assignment.id === null) {
        return new Error("cannot update unsaved shift assignment")
      }

      // 未公開の行のみ更新する。公開済み（published_at IS NOT NULL）は対象外で 0 行更新になる。
      // publishedAt は publish 専用の markPublished で扱うため、ここでは set しない。
      const rows = await this.c.var.database
        .update(shiftAssignments)
        .set({
          patternId: assignment.patternId,
          date: assignment.date,
          note: assignment.note,
        })
        .where(and(eq(shiftAssignments.id, assignment.id), isNull(shiftAssignments.publishedAt)))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : ShiftAssignment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update shift assignment")
    }
  }

  async delete(assignmentId: number): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(shiftAssignments)
        .where(and(eq(shiftAssignments.id, assignmentId), isNull(shiftAssignments.publishedAt)))
        .returning({ id: shiftAssignments.id })

      return rows.length === 0 ? null : true
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete shift assignment")
    }
  }
}
