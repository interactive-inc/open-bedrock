import { TrainingEnrollment } from "@/domain/training/training-enrollment"
import type { Context } from "@/env"
import { trainingEnrollments } from "@/schema"
import { and, eq } from "drizzle-orm"

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

  async create(trainingEnrollment: TrainingEnrollment): Promise<TrainingEnrollment | Error> {
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
      return error instanceof Error ? error : new Error("failed to insert training_enrollment")
    }
  }

  async update(trainingEnrollment: TrainingEnrollment): Promise<TrainingEnrollment | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(trainingEnrollments)
        .set({
          status: trainingEnrollment.status,
          completedAt: trainingEnrollment.completedAt,
          score: trainingEnrollment.score,
        })
        .where(eq(trainingEnrollments.id, trainingEnrollment.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : TrainingEnrollment.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update training_enrollment")
    }
  }
}
