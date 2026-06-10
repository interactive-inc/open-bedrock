import { canManageTraining } from "@/domain/training/can-manage-training"
import { TrainingEnrollment } from "@/domain/training/training-enrollment"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { TrainingCourseRepository } from "@/infrastructure/training/training-course-repository"
import {
  type AlreadyEnrolledError,
  TrainingEnrollmentRepository,
} from "@/infrastructure/training/training-enrollment-repository"

export type Command = {
  viewerEmployeeId: number
  viewerRole: string
  courseCode: string
  enrolleeEmployeeCode: string | null
  dueDate: string | null
}

export type Forbidden = { reason: "forbidden" }

export type EmployeeNotFound = { reason: "employee_not_found" }

export type CourseNotFound = { reason: "course_not_found" }

export type CourseArchived = { reason: "course_archived" }

export type AlreadyEnrolled = { reason: "already_enrolled" }

export type EnrollFailure =
  | Forbidden
  | EmployeeNotFound
  | CourseNotFound
  | CourseArchived
  | AlreadyEnrolled

/**
 * 自分、または管理権限を持つ者が他者を、研修コースに登録する。
 */
export class EnrollTraining {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<TrainingEnrollment | EnrollFailure | Error> {
    const courseRepository = new TrainingCourseRepository(this.c)

    const enrollmentRepository = new TrainingEnrollmentRepository(this.c)

    const employeeId = await this.toEnrolleeId(command)

    if (employeeId instanceof Error) {
      return employeeId
    }

    if (typeof employeeId !== "number") {
      return employeeId
    }

    const course = await courseRepository.findByCode(command.courseCode)

    if (course instanceof Error) {
      return course
    }

    if (course === null) {
      return { reason: "course_not_found" }
    }

    if (course.status === "archived") {
      return { reason: "course_archived" }
    }

    if (course.id === null) {
      return new Error("training course is not persisted")
    }

    const duplicate = await enrollmentRepository.findByCourseAndEmployee(course.id, employeeId)

    if (duplicate instanceof Error) {
      return duplicate
    }

    if (duplicate !== null) {
      return { reason: "already_enrolled" }
    }

    const enrollment = TrainingEnrollment.create({
      courseId: course.id,
      employeeId: employeeId,
      dueDate: command.dueDate,
    })

    const created = await enrollmentRepository.create(enrollment)

    if (created instanceof Error) {
      return created
    }

    if ("reason" in created) {
      return created as AlreadyEnrolledError
    }

    return created
  }

  private async toEnrolleeId(
    command: Command,
  ): Promise<number | Forbidden | EmployeeNotFound | Error> {
    if (command.enrolleeEmployeeCode === null) {
      return command.viewerEmployeeId
    }

    if (canManageTraining(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const employeeRepository = new EmployeeRepository(this.c)

    const employee = await employeeRepository.findByCode(command.enrolleeEmployeeCode)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    return employee.id
  }
}
