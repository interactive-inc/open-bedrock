import type { TrainingCourse } from "@/domain/training/training-course"
import type { Context } from "@/env"
import { TrainingCourseRepository } from "@/infrastructure/training/training-course-repository"

export type Command = {
  code: string
}

export type CourseNotFound = { reason: "course_not_found" }

/**
 * 研修コースをコードで1件取得する。全ユーザーが閲覧できる。
 */
export class GetTrainingCourse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingCourse | CourseNotFound | Error> {
    const courseRepository = new TrainingCourseRepository(this.c)

    const course = await courseRepository.findByCode(command.code)

    if (course instanceof Error) {
      return course
    }

    if (course === null) {
      return { reason: "course_not_found" }
    }

    return course
  }
}
