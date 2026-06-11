import { canCompleteEnrollment } from "@/domain/training/can-complete-enrollment"
import type { TrainingEnrollment } from "@/domain/training/training-enrollment"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/infrastructure/training/training-enrollment-repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: number
  viewerRole: string
  score: number | null
  completedAt: string
}

export type EnrollmentNotFound = { reason: "enrollment_not_found" }

export type Forbidden = { reason: "forbidden" }

export type AlreadyCompleted = { reason: "already_completed" }

export type CompleteFailure = EnrollmentNotFound | Forbidden | AlreadyCompleted

/**
 * 受講を完了として記録する。本人または管理権限が必要。
 */
export class CompleteTrainingEnrollment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingEnrollment | CompleteFailure | Error> {
    const enrollmentRepository = new TrainingEnrollmentRepository(this.c)

    const enrollment = await enrollmentRepository.findById(command.enrollmentId)

    if (enrollment instanceof Error) {
      return enrollment
    }

    if (enrollment === null) {
      return { reason: "enrollment_not_found" }
    }

    const canComplete = canCompleteEnrollment({
      enrollmentEmployeeId: enrollment.employeeId,
      viewerEmployeeId: command.viewerEmployeeId,
      viewerRole: command.viewerRole,
    })

    if (canComplete === false) {
      return { reason: "forbidden" }
    }

    if (enrollment.status === "completed") {
      return { reason: "already_completed" }
    }

    const completed = await enrollmentRepository.completeEnrollment(
      enrollment.complete(command.completedAt, command.score),
    )

    if (completed instanceof Error) {
      return completed
    }

    if (completed === null) {
      return { reason: "enrollment_not_found" }
    }

    return completed
  }
}
