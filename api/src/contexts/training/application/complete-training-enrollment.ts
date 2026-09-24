import { isTrainingRecordSourceFrozenError } from "@/contexts/training/infrastructure/repositories/lib/is-training-record-source-frozen-error"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { canCompleteEnrollment } from "@/contexts/training/domain/policies/enrollment-completion.policy"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { TrainingEnrollment } from "@/contexts/training/domain/entities/training-enrollment.entity"
import type { TrainingEnrollmentRepository } from "@/contexts/training/infrastructure/repositories/training-enrollment.repository"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type Context = Readonly<{
  enrollmentRepository: Pick<TrainingEnrollmentRepository, "findById" | "completeEnrollment">
}>

export type Command = {
  enrollmentId: number
  viewerEmployeeId: EmployeeId
  session: CompanySessionValue
  score: number | null
  completedAt: string
}

/**
 * 受講を完了として記録する。本人または管理権限が必要。
 */
export class CompleteTrainingEnrollment {
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

    const completed = await this.c.enrollmentRepository.completeEnrollment(
      enrollment.complete(command.completedAt, command.score),
    )

    if (completed instanceof Error) {
      if (isTrainingRecordSourceFrozenError(completed))
        return new ConflictError("training writes are frozen", "record_source_frozen", {
          cause: completed,
        })
      return new UnexpectedError("failed to update training enrollment", { cause: completed })
    }

    if (completed === null) {
      return new NotFoundError("enrollment not found", "enrollment_not_found")
    }

    return completed
  }
}
