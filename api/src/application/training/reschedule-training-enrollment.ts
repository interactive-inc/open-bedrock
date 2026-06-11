import { canModifyEnrollment } from "@/domain/training/can-modify-enrollment"
import type { TrainingEnrollment } from "@/domain/training/training-enrollment"
import type { Context } from "@/env"
import { TrainingEnrollmentRepository } from "@/infrastructure/training/training-enrollment-repository"

export type Command = {
  enrollmentId: number
  viewerEmployeeId: number
  viewerRole: string
  dueDate: string | null
}

export type EnrollmentNotFound = { reason: "enrollment_not_found" }

export type Forbidden = { reason: "forbidden" }

export type AlreadyCompleted = { reason: "already_completed" }

export type RescheduleFailure = EnrollmentNotFound | Forbidden | AlreadyCompleted

/**
 * 受講期限を変更する。本人または管理権限が必要。完了済みの受講は変更できない。
 */
export class RescheduleTrainingEnrollment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingEnrollment | RescheduleFailure | Error> {
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

    if (enrollment.status === "completed") {
      return { reason: "already_completed" }
    }

    const updated = await enrollmentRepository.rescheduleEnrollment(
      enrollment.withRescheduled(command.dueDate),
    )

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "enrollment_not_found" }
    }

    return updated
  }
}
