import { canModifyEnrollment } from "@/lib/training/can-modify-enrollment"
import type { TrainingEnrollment } from "@/domain/training/training-enrollment.entity"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/infrastructure/training/training-enrollment-repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: number
  viewerRole: string
}

export type EnrollmentNotFound = { reason: "enrollment_not_found" }

export type Forbidden = { reason: "forbidden" }

export type GetFailure = EnrollmentNotFound | Forbidden

/**
 * 受講登録を1件取得する。本人または管理権限を持つ者だけが閲覧できる。
 */
export class GetTrainingEnrollment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingEnrollment | GetFailure | Error> {
    const enrollmentRepository = new TrainingEnrollmentRepository(this.c)

    const enrollment = await enrollmentRepository.findById(command.enrollmentId)

    if (enrollment instanceof Error) {
      return enrollment
    }

    if (enrollment === null) {
      return { reason: "enrollment_not_found" }
    }

    const canModify = canModifyEnrollment({
      enrollmentEmployeeId: enrollment.employeeId,
      viewerEmployeeId: command.viewerEmployeeId,
      viewerRole: command.viewerRole,
    })

    if (canModify === false) {
      return { reason: "forbidden" }
    }

    return enrollment
  }
}
