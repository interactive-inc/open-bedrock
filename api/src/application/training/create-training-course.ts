import { canManageTraining } from "@/lib/training/can-manage-training"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { TrainingCourse } from "@/domain/training/training-course.entity"
import type { Context, SessionPayload } from "@/env"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { TrainingCourseRepository } from "@/infrastructure/training/training-course-repository"

export type Command = {
  session: SessionPayload
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
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingCourse | ApplicationError> {
    const courseRepository = new TrainingCourseRepository(this.c)

    if (canManageTraining(command.session) === false) {
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
