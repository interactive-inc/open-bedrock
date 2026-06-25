import { canModifyEnrollment } from "@/lib/training/can-modify-enrollment"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/infrastructure/training/training-enrollment-repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: number
  viewerRole: string
}

export type Cancelled = { reason: "cancelled" }

/**
 * 受講登録を取り消す。本人または管理権限が必要。完了済みは履歴保全のため取り消せない。
 */
export class CancelTrainingEnrollment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
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
      viewerRole: command.viewerRole,
    })

    if (canModify === false) {
      return new ForbiddenError("cannot cancel enrollment", "forbidden")
    }

    const deleted = await enrollmentRepository.delete(command.enrollmentId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete training enrollment", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError(
        "enrollment is completed or failed and cannot be cancelled",
        "enrollment_not_cancelable",
      )
    }

    return { reason: "cancelled" }
  }
}
