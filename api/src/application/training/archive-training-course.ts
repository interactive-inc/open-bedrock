import { canManageTraining } from "@/lib/training/can-manage-training"
import type { Context } from "@/env"
import { TrainingCourseRepository } from "@/infrastructure/training/training-course-repository"

export type Command = {
  viewerRole: string
  code: string
}

export type Forbidden = { reason: "forbidden" }

export type CourseNotFound = { reason: "course_not_found" }

export type Archived = { reason: "archived" }

export type ArchiveFailure = Forbidden | CourseNotFound

/**
 * 管理権限を持つ者が研修コースをアーカイブする。受講履歴を壊さないため物理削除はしない。
 */
export class ArchiveTrainingCourse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Archived | ArchiveFailure | Error> {
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

    const updated = await courseRepository.update(current.archive())

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "course_not_found" }
    }

    return { reason: "archived" }
  }
}
