import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { canCompleteEnrollment } from "@/contexts/training/application/can-complete-enrollment"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { TrainingEnrollment } from "@/contexts/training/domain/training-enrollment.entity"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/contexts/training/infrastructure/training-enrollment-repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: number
  session: Session
  score: number | null
  completedAt: string
}

/**
 * 受講を完了として記録する。本人または管理権限が必要。
 */
export class CompleteTrainingEnrollment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingEnrollment | ApplicationError> {
    const enrollmentRepository = new TrainingEnrollmentRepository(this.c)

    const enrollment = await enrollmentRepository.findById(command.enrollmentId)

    if (enrollment instanceof Error) {
      return new UnexpectedError("failed to find training enrollment", { cause: enrollment })
    }

    if (enrollment === null) {
      return new NotFoundError("enrollment not found", "enrollment_not_found")
    }

    const canComplete = canCompleteEnrollment({
      enrollmentEmployeeId: enrollment.employeeId,
      viewerEmployeeId: command.viewerEmployeeId,
      session: command.session,
    })

    if (canComplete === false) {
      return new ForbiddenError("cannot complete enrollment", "forbidden")
    }

    if (enrollment.status === "completed") {
      return new ConflictError("enrollment is already completed", "already_completed")
    }

    const completed = await enrollmentRepository.completeEnrollment(
      enrollment.complete(command.completedAt, command.score),
    )

    if (completed instanceof Error) {
      return new UnexpectedError("failed to update training enrollment", { cause: completed })
    }

    if (completed === null) {
      return new NotFoundError("enrollment not found", "enrollment_not_found")
    }

    return completed
  }
}
