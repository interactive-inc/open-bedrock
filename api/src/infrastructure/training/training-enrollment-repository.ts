import { TrainingEnrollment } from "@/domain/training/training-enrollment"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { trainingEnrollments } from "@/schema"
import { and, eq } from "drizzle-orm"

export type AlreadyEnrolledError = { reason: "already_enrolled" }

export class TrainingEnrollmentRepository {
  constructor(private readonly c: Context) {}

  async findById(enrollmentId: number): Promise<TrainingEnrollment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(trainingEnrollments)
        .where(eq(trainingEnrollments.id, enrollmentId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : TrainingEnrollment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load training_enrollment")
    }
  }

  async findByCourseAndEmployee(
    courseId: number,
    employeeId: number,
  ): Promise<TrainingEnrollment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(trainingEnrollments)
        .where(
          and(
            eq(trainingEnrollments.courseId, courseId),
            eq(trainingEnrollments.employeeId, employeeId),
          ),
        )
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : TrainingEnrollment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load training_enrollment")
    }
  }

  // UNIQUE 制約 (course_id, employee_id) に違反した場合は already_enrolled を返す。
  async create(
    trainingEnrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment | AlreadyEnrolledError | Error> {
    try {
      const rows = await this.c.var.database
        .insert(trainingEnrollments)
        .values({
          courseId: trainingEnrollment.courseId,
          employeeId: trainingEnrollment.employeeId,
          status: trainingEnrollment.status,
          completedAt: trainingEnrollment.completedAt,
          score: trainingEnrollment.score,
          dueDate: trainingEnrollment.dueDate,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert training_enrollment")
        : TrainingEnrollment.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { reason: "already_enrolled" }
      }
      return error instanceof Error ? error : new Error("failed to insert training_enrollment")
    }
  }

  async update(trainingEnrollment: TrainingEnrollment): Promise<TrainingEnrollment | null | Error> {
    try {
      if (trainingEnrollment.id === null) {
        return new Error("cannot update unsaved training enrollment")
      }

      const rows = await this.c.var.database
        .update(trainingEnrollments)
        .set({
          status: trainingEnrollment.status,
          completedAt: trainingEnrollment.completedAt,
          score: trainingEnrollment.score,
          dueDate: trainingEnrollment.dueDate,
        })
        .where(eq(trainingEnrollments.id, trainingEnrollment.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : TrainingEnrollment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update training_enrollment")
    }
  }

  // 受講登録を削除する。
  async delete(enrollmentId: number): Promise<null | Error> {
    try {
      await this.c.var.database
        .delete(trainingEnrollments)
        .where(eq(trainingEnrollments.id, enrollmentId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete training_enrollment")
    }
  }
}
