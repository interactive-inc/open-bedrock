import type { Session } from "@/domain/company/iam/session"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { TrainingCourseRepository } from "@/infrastructure/training/training-course-repository"

export type Command = {
  session: Session
  code: string
}

export type Archived = { reason: "archived" }

/**
 * 管理権限を持つ者が研修コースをアーカイブする。受講履歴を壊さないため物理削除はしない。
 */
export class ArchiveTrainingCourse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Archived | ApplicationError> {
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

    const updated = await courseRepository.update(current.archive())

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update training course", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("course not found", "course_not_found")
    }

    return { reason: "archived" }
  }
}
