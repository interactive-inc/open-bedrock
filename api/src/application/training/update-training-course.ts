import { canManageTraining } from "@/lib/training/can-manage-training"
import type { TrainingCourse } from "@/domain/training/training-course.entity"
import type { Context } from "@/env"
import { TrainingCourseRepository } from "@/infrastructure/training/training-course-repository"

export type Command = {
  viewerRole: string
  code: string
  title: string
  category: string
  description: string | null
  durationMinutes: number | null
  isRequired: boolean
}

export type Forbidden = { reason: "forbidden" }

export type CourseNotFound = { reason: "course_not_found" }

export type CourseArchived = { reason: "course_archived" }

export type UpdateFailure = Forbidden | CourseNotFound | CourseArchived

/**
 * 管理権限を持つ者が研修コースの内容を変更する。code と status は変更しない。
 */
export class UpdateTrainingCourse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingCourse | UpdateFailure | Error> {
    const courseRepository = new TrainingCourseRepository(this.c)

    if (canManageTraining(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const current = await courseRepository.findByCode(command.code)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "course_not_found" }
    }

    if (current.status === "archived") {
      return { reason: "course_archived" }
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
      return updated
    }

    if (updated === null) {
      return { reason: "course_not_found" }
    }

    return updated
  }
}
