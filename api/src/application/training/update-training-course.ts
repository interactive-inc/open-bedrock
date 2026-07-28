import type { Session } from "@/lib/auth/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { TrainingCourse } from "@/domain/training/training-course.entity"
import type { Context } from "@/env"
import { TrainingCourseRepository } from "@/infrastructure/training/training-course-repository"

export type Command = {
  session: Session
  code: string
  title: string
  category: string
  description: string | null
  durationMinutes: number | null
  isRequired: boolean
}

/**
 * 管理権限を持つ者が研修コースの内容を変更する。code と status は変更しない。
 */
export class UpdateTrainingCourse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingCourse | ApplicationError> {
    const courseRepository = new TrainingCourseRepository(this.c)

    if (command.session.hasPermission("training:manage") === false) {
      return new ForbiddenError("cannot manage training", "forbidden")
    }

    const current = await courseRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find training course", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("course not found", "course_not_found")
    }

    if (current.status === "archived") {
      return new ConflictError("course is archived", "course_archived")
    }

    const updated = await courseRepository.update(
      current.withDetails({
        title: command.title,
        category: command.category,
        description: command.description,
        durationMinutes: command.durationMinutes,
        isRequired: command.isRequired,
      }),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update training course", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("course not found", "course_not_found")
    }

    return updated
  }
}
