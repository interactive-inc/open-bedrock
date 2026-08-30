import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { canModifyEnrollment } from "@/contexts/training/domain/policies/enrollment-modification.policy"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/contexts/training/infrastructure/repositories/training-enrollment.repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: EmployeeId
  session: CompanySessionValue
}

export type Cancelled = { reason: "cancelled" }

/**
 * 受講登録を取り消す。本人または管理権限が必要。完了済みは履歴保全のため取り消せない。
 */
export class CancelTrainingEnrollment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
      session: command.session,
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
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
