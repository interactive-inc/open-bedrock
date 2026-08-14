import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { TrainingCourse } from "@/contexts/company/domain/training/training-course.entity"
import type { Context } from "@/env"
import { TrainingCourseRepository } from "@/contexts/company/infrastructure/training/training-course-repository"

export type Command = {
  code: string
}

/**
 * 研修コースをコードで1件取得する。全ユーザーが閲覧できる。
 */
export class GetTrainingCourse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingCourse | ApplicationError> {
    const courseRepository = new TrainingCourseRepository(this.c)

    const course = await courseRepository.findByCode(command.code)

    if (course instanceof Error) {
      return new UnexpectedError("failed to find training course", { cause: course })
    }

    if (course === null) {
      return new NotFoundError("course not found", "course_not_found")
    }

    return course
  }
}
