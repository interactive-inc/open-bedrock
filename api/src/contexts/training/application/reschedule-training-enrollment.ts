import { isTrainingRecordSourceFrozenError } from "@/contexts/training/infrastructure/repositories/lib/is-training-record-source-frozen-error"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { canModifyEnrollment } from "@/contexts/training/domain/policies/enrollment-modification.policy"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { TrainingEnrollment } from "@/contexts/training/domain/entities/training-enrollment.entity"
import type { TrainingEnrollmentRepository } from "@/contexts/training/infrastructure/repositories/training-enrollment.repository"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type Context = Readonly<{
  enrollmentRepository: Pick<TrainingEnrollmentRepository, "findById" | "rescheduleEnrollment">
}>

export type Command = {
  enrollmentId: string
  viewerEmployeeId: EmployeeId
  session: CompanySessionValue
  dueDate: string | null
}

/**
 * 受講期限を変更する。本人または管理権限が必要。完了済みの受講は変更できない。
 */
export class RescheduleTrainingEnrollment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<TrainingEnrollment | ApplicationError> {
    const enrollment = await this.c.enrollmentRepository.findById(command.enrollmentId)

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

    const updated = await this.c.enrollmentRepository.rescheduleEnrollment(
      enrollment.withRescheduled(command.dueDate),
    )

    if (updated instanceof Error) {
      if (isTrainingRecordSourceFrozenError(updated))
        return new ConflictError("training writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      return new UnexpectedError("failed to update training enrollment", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("enrollment not found", "enrollment_not_found")
    }

    return updated
  }
}
