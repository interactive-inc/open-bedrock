import { TrainingCourse } from "@/domain/training/training-course"
import type { Context } from "@/env"
import { trainingCourses } from "@/schema"
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
      return error instanceof Error ? error : new Error("failed to insert training_course")
    }
  }
}
