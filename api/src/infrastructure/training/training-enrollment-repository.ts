import { TrainingEnrollment } from "@/domain/training/training-enrollment.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { trainingEnrollments } from "@/schema"
import { and, eq, ne, sql } from "drizzle-orm"

export type AlreadyEnrolledError = { reason: "already_enrolled" }

export type CourseArchivedError = { reason: "course_archived" }

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

  /**
   * コースがアーカイブ済みでないことをアトミックに検証して INSERT する。
   * UNIQUE 制約 (course_id, employee_id) 違反時は already_enrolled を返す。
   * コースがアーカイブ済みの場合は course_archived を返す。
   */
  async create(
    trainingEnrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment | AlreadyEnrolledError | CourseArchivedError | Error> {
    try {
      const result = await this.c.var.database.run(
        sql`INSERT INTO training_enrollments (course_id, employee_id, status, completed_at, score, due_date)
            SELECT ${trainingEnrollment.courseId}, ${trainingEnrollment.employeeId},
                   ${trainingEnrollment.status}, ${trainingEnrollment.completedAt},
                   ${trainingEnrollment.score}, ${trainingEnrollment.dueDate}
            WHERE EXISTS (
              SELECT 1 FROM training_courses
              WHERE id = ${trainingEnrollment.courseId} AND status != 'archived'
            )`,
      )

      if (result.meta.changes === 0) {
        return { reason: "course_archived" }
      }

      const rows = await this.c.var.database
        .select()
        .from(trainingEnrollments)
        .where(eq(trainingEnrollments.id, Number(result.meta.last_row_id)))
        .limit(1)

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to retrieve inserted training_enrollment")
        : TrainingEnrollment.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { reason: "already_enrolled" }
      }
      return error instanceof Error ? error : new Error("failed to insert training_enrollment")
    }
  }

  /** enrolled 状態の受講登録を完了にする。status が enrolled でなければ 0 行更新（null）。 */
  async completeEnrollment(
    trainingEnrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment | null | Error> {
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
        .where(
          and(
            eq(trainingEnrollments.id, trainingEnrollment.id),
            eq(trainingEnrollments.status, "enrolled"),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : TrainingEnrollment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to complete training_enrollment")
    }
  }

  /** enrolled 状態の受講登録の期限を変更する。status が enrolled でなければ 0 行更新（null）。 */
  async rescheduleEnrollment(
    trainingEnrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment | null | Error> {
    try {
      if (trainingEnrollment.id === null) {
        return new Error("cannot update unsaved training enrollment")
      }

      const rows = await this.c.var.database
        .update(trainingEnrollments)
        .set({
          dueDate: trainingEnrollment.dueDate,
        })
        .where(
          and(
            eq(trainingEnrollments.id, trainingEnrollment.id),
            eq(trainingEnrollments.status, "enrolled"),
          ),
        )
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : TrainingEnrollment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to reschedule training_enrollment")
    }
  }

  /** 完了・失敗以外の受講登録を削除する。完了・失敗済みは履歴保全のため削除不可（null）。 */
  async delete(enrollmentId: number): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(trainingEnrollments)
        .where(
          and(
            eq(trainingEnrollments.id, enrollmentId),
            ne(trainingEnrollments.status, "completed"),
            ne(trainingEnrollments.status, "failed"),
          ),
        )
        .returning()

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete training_enrollment")
    }
  }
}
