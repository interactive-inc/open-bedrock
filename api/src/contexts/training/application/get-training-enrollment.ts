import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { canModifyEnrollment } from "@/contexts/training/application/can-modify-enrollment"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { TrainingEnrollment } from "@/contexts/training/domain/training-enrollment.entity"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/contexts/training/infrastructure/training-enrollment-repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: number
  session: Session
}

/**
 * 受講登録を1件取得する。本人または管理権限を持つ者だけが閲覧できる。
 */
export class GetTrainingEnrollment {
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
      return new ForbiddenError("cannot access enrollment", "forbidden")
    }

    return enrollment
  }
}
