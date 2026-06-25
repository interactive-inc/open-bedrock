import { canManageTraining } from "@/lib/training/can-manage-training"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"
import { TrainingEnrollment } from "@/domain/training/training-enrollment.entity"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { TrainingCourseRepository } from "@/infrastructure/training/training-course-repository"
import { TrainingEnrollmentRepository } from "@/infrastructure/training/training-enrollment-repository"

export type Command = {
  viewerEmployeeId: number
  viewerRole: string
  courseCode: string
  enrolleeEmployeeCode: string | null
  dueDate: string | null
}

/**
 * 自分、または管理権限を持つ者が他者を、研修コースに登録する。
 */
export class EnrollTraining {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingEnrollment | ApplicationError> {
    const courseRepository = new TrainingCourseRepository(this.c)

    const enrollmentRepository = new TrainingEnrollmentRepository(this.c)

    const employeeId = await this.toEnrolleeId(command)

    if (employeeId instanceof ApplicationError) {
      return employeeId
    }

    const course = await courseRepository.findByCode(command.courseCode)

    if (course instanceof Error) {
      return new UnexpectedError("failed to find training course", { cause: course })
    }

    if (course === null) {
      return new NotFoundError("course not found", "course_not_found")
    }

    if (course.id === null) {
      return new UnexpectedError("training course is not persisted")
    }

    const enrollment = TrainingEnrollment.create({
      courseId: course.id,
      employeeId: employeeId,
      dueDate: command.dueDate,
    })

    // INSERT...SELECT WHERE EXISTS でコースがアーカイブ済みでないことをアトミックに検証する。
    // UNIQUE 制約で重複登録も検出する。
    const created = await enrollmentRepository.create(enrollment)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create training enrollment", { cause: created })
    }

    if ("reason" in created) {
      if (created.reason === "course_archived") {
        return new ConflictError("course is archived", "course_archived")
      }

      return new ConflictError("already enrolled", "already_enrolled")
    }

    return created
  }

  private async toEnrolleeId(command: Command): Promise<number | ApplicationError> {
    if (command.enrolleeEmployeeCode === null) {
      return command.viewerEmployeeId
    }

    if (canManageTraining(command.viewerRole) === false) {
      return new ForbiddenError("cannot enroll others", "forbidden")
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findByCode(command.enrolleeEmployeeCode)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    return employee.id
  }
}
