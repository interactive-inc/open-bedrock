import { canManageTraining } from "@/domain/training/can-manage-training"
import { TrainingCourse } from "@/domain/training/training-course"
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

export type CourseCodeConflict = { reason: "course_code_conflict" }

/**
 * 管理権限を持つ者が新しい研修コースを作成する。
 */
export class CreateTrainingCourse {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingCourse | Forbidden | CourseCodeConflict | Error> {
    const courseRepository = new TrainingCourseRepository(this.c)

    if (canManageTraining(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const existing = await courseRepository.findByCode(command.code)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "course_code_conflict" }
    }

    const trainingCourse = TrainingCourse.create({
      code: command.code,
      title: command.title,
      category: command.category,
      description: command.description,
      durationMinutes: command.durationMinutes,
      isRequired: command.isRequired,
    })

    return courseRepository.create(trainingCourse)
  }
}
