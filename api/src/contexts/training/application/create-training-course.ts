import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { TrainingCourse } from "@/contexts/training/domain/entities/training-course.entity"
import type { Context } from "@/env"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { TrainingCourseRepository } from "@/contexts/training/infrastructure/repositories/training-course.repository"

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
 * 管理権限を持つ者が新しい研修コースを作成する。
 */
export class CreateTrainingCourse {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<TrainingCourse | ApplicationError> {
    const courseRepository = new TrainingCourseRepository(this.c)

    if (command.session.hasPermission("training:manage") === false) {
      return new ForbiddenError("cannot manage training", "forbidden")
    }

    const existing = await courseRepository.findByCode(command.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find training course", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("course code already exists", "course_code_conflict")
    }

    const trainingCourse = TrainingCourse.create({
      code: command.code,
      title: command.title,
      category: command.category,
      description: command.description,
      durationMinutes: command.durationMinutes,
      isRequired: command.isRequired,
    })

    const result = await courseRepository.create(trainingCourse)

    if (result instanceof UniqueConstraintError) {
      return new ConflictError("course code already exists", "course_code_conflict")
    }

    if (result instanceof Error) {
      return new UnexpectedError("failed to create training course", { cause: result })
    }

    return result
  }
}
