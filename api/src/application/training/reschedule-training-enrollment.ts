import type { Session } from "@/lib/auth/session"
import { canModifyEnrollment } from "@/application/training/can-modify-enrollment"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { TrainingEnrollment } from "@/domain/training/training-enrollment.entity"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/infrastructure/training/training-enrollment-repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: number
  session: Session
  dueDate: string | null
}

/**
 * 受講期限を変更する。本人または管理権限が必要。完了済みの受講は変更できない。
 */
export class RescheduleTrainingEnrollment {
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

    const canModify = canModifyEnrollment({
      enrollmentEmployeeId: enrollment.employeeId,
      viewerEmployeeId: command.viewerEmployeeId,
      session: command.session,
    })

    if (canModify === false) {
      return new ForbiddenError("cannot modify enrollment", "forbidden")
    }

    if (enrollment.status === "completed") {
      return new ConflictError("enrollment is already completed", "already_completed")
    }

    const updated = await enrollmentRepository.rescheduleEnrollment(
      enrollment.withRescheduled(command.dueDate),
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update training enrollment", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("enrollment not found", "enrollment_not_found")
    }

    return updated
  }
}
