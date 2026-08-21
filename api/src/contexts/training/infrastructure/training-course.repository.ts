import { TrainingCourse } from "@/contexts/training/domain/entities/training-course.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"
import { trainingCourses } from "@/contexts/training/infrastructure/schema/training"
import { eq } from "drizzle-orm"

export class TrainingCourseRepository {
  constructor(private readonly c: Context) {}

  async findByCode(code: string): Promise<TrainingCourse | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(trainingCourses)
        .where(eq(trainingCourses.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : TrainingCourse.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load training_course")
    }
  }

  async findById(courseId: number): Promise<TrainingCourse | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(trainingCourses)
        .where(eq(trainingCourses.id, courseId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : TrainingCourse.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load training_course")
    }
  }

  async create(trainingCourse: TrainingCourse): Promise<TrainingCourse | Error> {
    try {
      const rows = await this.c.var.database
        .insert(trainingCourses)
        .values({
          code: trainingCourse.code,
          title: trainingCourse.title,
          description: trainingCourse.description,
          durationMinutes: trainingCourse.durationMinutes,
          category: trainingCourse.category,
          isRequired: trainingCourse.isRequired,
          status: trainingCourse.status,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert training_course")
        : TrainingCourse.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("training course already exists", { cause: error })
      }
      return error instanceof Error ? error : new Error("failed to insert training_course")
    }
  }

  /**
   * 研修コースの内容と状態を更新する。code をキーに更新し、更新後の行を返す。
   * 0 行更新（該当なし）の場合は null を返す。
   */
  async update(trainingCourse: TrainingCourse): Promise<TrainingCourse | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(trainingCourses)
        .set({
          title: trainingCourse.title,
          description: trainingCourse.description,
          durationMinutes: trainingCourse.durationMinutes,
          category: trainingCourse.category,
          isRequired: trainingCourse.isRequired,
          status: trainingCourse.status,
        })
        .where(eq(trainingCourses.code, trainingCourse.code))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : TrainingCourse.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update training_course")
    }
  }
}
