import { isTrainingRecordSourceFrozenError } from "@/contexts/training/infrastructure/repositories/lib/is-training-record-source-frozen-error"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { TrainingCourse } from "@/contexts/training/domain/entities/training-course.entity"
import type { TrainingCourseRepository } from "@/contexts/training/infrastructure/repositories/training-course.repository"

type Context = Readonly<{
  courseRepository: Pick<TrainingCourseRepository, "findByCode" | "update">
}>

export type Command = {
  session: CompanySessionValue
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
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<TrainingCourse | ApplicationError> {
    if (command.session.hasPermission("training:manage") === false) {
      return new ForbiddenError("cannot manage training", "forbidden")
    }

    const current = await this.c.courseRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find training course", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("course not found", "course_not_found")
    }

    if (current.status === "archived") {
      return new ConflictError("course is archived", "course_archived")
    }

    const updated = await this.c.courseRepository.update(
      current.withDetails({
        title: command.title,
        category: command.category,
        description: command.description,
        durationMinutes: command.durationMinutes,
        isRequired: command.isRequired,
      }),
    )

    if (updated instanceof Error) {
      if (isTrainingRecordSourceFrozenError(updated))
        return new ConflictError("training writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      return new UnexpectedError("failed to update training course", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("course not found", "course_not_found")
    }

    return updated
  }
}
