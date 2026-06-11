import { canModifyEnrollment } from "@/domain/training/can-modify-enrollment"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/infrastructure/training/training-enrollment-repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: number
  viewerRole: string
}

export type EnrollmentNotFound = { reason: "enrollment_not_found" }

export type Forbidden = { reason: "forbidden" }

export type AlreadyCompleted = { reason: "already_completed" }

export type Cancelled = { reason: "cancelled" }

export type CancelFailure = EnrollmentNotFound | Forbidden | AlreadyCompleted

/**
 * 受講登録を取り消す。本人または管理権限が必要。完了済みは履歴保全のため取り消せない。
 */
export class CancelTrainingEnrollment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | CancelFailure | Error> {
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

    if (enrollment.status === "completed" || enrollment.status === "failed") {
      return { reason: "already_completed" }
    }

    const deleted = await enrollmentRepository.delete(command.enrollmentId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
