import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"
import { TrainingCourse } from "@/contexts/training/domain/entities/training-course.entity"
import { TrainingEnrollment } from "@/contexts/training/domain/entities/training-enrollment.entity"
import { CreateTrainingCourse } from "@/contexts/training/application/create-training-course"
import { UpdateTrainingCourse } from "@/contexts/training/application/update-training-course"
import { ArchiveTrainingCourse } from "@/contexts/training/application/archive-training-course"
import { EnrollTraining } from "@/contexts/training/application/enroll-training"
import { RescheduleTrainingEnrollment } from "@/contexts/training/application/reschedule-training-enrollment"
import { CompleteTrainingEnrollment } from "@/contexts/training/application/complete-training-enrollment"
import { CancelTrainingEnrollment } from "@/contexts/training/application/cancel-training-enrollment"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"

/**
 * 研修コースと受講登録のRepositoryを、Domain modelだけを持つ型付きfakeにする。
 * アーカイブ済みコースへの条件付きINSERT、完了の条件付きUPDATEのSQLは
 * training-enrollment.repository.test.ts が検証する。
 */
class FakeTraining {
  private readonly courses = new Map<string, TrainingCourse>()

  private readonly enrollments = new Map<string, TrainingEnrollment>()

  readonly courseRepository = {
    findByCode: async (code: string) => this.courses.get(code) ?? null,
    create: async (course: TrainingCourse) => {
      const created = new TrainingCourse({
        id: crypto.randomUUID(),
        code: course.code,
        title: course.title,
        description: course.description,
        durationMinutes: course.durationMinutes,
        category: course.category,
        isRequired: course.isRequired,
        status: course.status,
      })
      this.courses.set(created.code, created)
      return created
    },
    update: async (course: TrainingCourse) => {
      if (!this.courses.has(course.code)) return null
      this.courses.set(course.code, course)
      return course
    },
  }

  readonly enrollmentRepository = {
    findById: async (id: string) => this.enrollments.get(id) ?? null,
    create: async (enrollment: TrainingEnrollment) => {
      const course = [...this.courses.values()].find((item) => item.id === enrollment.courseId)
      if (course === undefined || course.status === "archived") {
        return { reason: "course_archived" as const }
      }
      const created = new TrainingEnrollment({
        id: crypto.randomUUID(),
        courseId: enrollment.courseId,
        employeeId: enrollment.employeeId,
        status: enrollment.status,
        completedAt: enrollment.completedAt,
        score: enrollment.score,
        dueDate: enrollment.dueDate,
      })
      this.enrollments.set(created.id ?? "", created)
      return created
    },
    completeEnrollment: async (enrollment: TrainingEnrollment) => this.replaceEnrolled(enrollment),
    rescheduleEnrollment: async (enrollment: TrainingEnrollment) =>
      this.replaceEnrolled(enrollment),
    delete: async (id: string) => (this.enrollments.delete(id) ? (true as const) : null),
  }

  readonly employeeDirectory = {
    findByCode: async () => null,
  }

  private replaceEnrolled(enrollment: TrainingEnrollment): TrainingEnrollment | null {
    if (enrollment.id === null) return null
    if (this.enrollments.get(enrollment.id)?.status !== "enrolled") return null
    this.enrollments.set(enrollment.id, enrollment)
    return enrollment
  }

  async seedCourse(code: string): Promise<TrainingCourse> {
    const result = await new CreateTrainingCourse(this).run({
      session: makeTestSession("root"),
      code: code,
      title: "Test Course",
      category: "engineering",
      description: null,
      durationMinutes: 60,
      isRequired: false,
    })

    if (result instanceof Error) {
      throw new Error("seed course failed")
    }

    return result
  }

  async seedEnrollment(courseCode: string, employeeId: EmployeeId): Promise<string> {
    await this.seedCourse(courseCode)

    const result = await new EnrollTraining(this).run({
      viewerEmployeeId: employeeId,
      session: makeTestSession("member"),
      courseCode: courseCode,
      enrolleeEmployeeCode: null,
      dueDate: "2026-06-30",
    })

    if (result instanceof Error || result.id === null) {
      throw new Error("seed enrollment failed")
    }

    return result.id
  }
}

describe("CreateTrainingCourse", () => {
  test("creates a course as admin", async () => {
    const training = new FakeTraining()

    const result = await new CreateTrainingCourse(training).run({
      session: makeTestSession("root"),
      code: "TS101",
      title: "TypeScript Basics",
      category: "engineering",
      description: "Learn TypeScript fundamentals",
      durationMinutes: 120,
      isRequired: true,
    })

    expect(result).toBeInstanceOf(TrainingCourse)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.code).toBe("TS101")
    expect(result.status).toBe("active")
  })

  test("rejects member with forbidden", async () => {
    const training = new FakeTraining()

    const result = await new CreateTrainingCourse(training).run({
      session: makeTestSession("member"),
      code: "TS101",
      title: "TypeScript Basics",
      category: "engineering",
      description: null,
      durationMinutes: null,
      isRequired: false,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects duplicate code with course_code_conflict", async () => {
    const training = new FakeTraining()

    await training.seedCourse("TS101")

    const result = await new CreateTrainingCourse(training).run({
      session: makeTestSession("root"),
      code: "TS101",
      title: "Another Course",
      category: "other",
      description: null,
      durationMinutes: null,
      isRequired: false,
    })

    expectApplicationError(result, ConflictError, "course_code_conflict")
  })
})

describe("UpdateTrainingCourse", () => {
  test("updates the course as admin", async () => {
    const training = new FakeTraining()

    await training.seedCourse("TS101")

    const result = await new UpdateTrainingCourse(training).run({
      session: makeTestSession("root"),
      code: "TS101",
      title: "Updated Title",
      category: "management",
      description: "Updated desc",
      durationMinutes: 180,
      isRequired: true,
    })

    expect(result).toBeInstanceOf(TrainingCourse)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.title).toBe("Updated Title")
    expect(result.category).toBe("management")
  })

  test("rejects member with forbidden", async () => {
    const training = new FakeTraining()

    await training.seedCourse("TS101")

    const result = await new UpdateTrainingCourse(training).run({
      session: makeTestSession("member"),
      code: "TS101",
      title: "Hijacked",
      category: "other",
      description: null,
      durationMinutes: null,
      isRequired: false,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects archived course with course_archived", async () => {
    const training = new FakeTraining()

    await training.seedCourse("TS101")

    await new ArchiveTrainingCourse(training).run({
      session: makeTestSession("root"),
      code: "TS101",
    })

    const result = await new UpdateTrainingCourse(training).run({
      session: makeTestSession("root"),
      code: "TS101",
      title: "Too late",
      category: "other",
      description: null,
      durationMinutes: null,
      isRequired: false,
    })

    expectApplicationError(result, ConflictError, "course_archived")
  })

  test("rejects unknown code with course_not_found", async () => {
    const training = new FakeTraining()

    const result = await new UpdateTrainingCourse(training).run({
      session: makeTestSession("root"),
      code: "NOPE",
      title: "Missing",
      category: "other",
      description: null,
      durationMinutes: null,
      isRequired: false,
    })

    expectApplicationError(result, NotFoundError, "course_not_found")
  })
})

describe("ArchiveTrainingCourse", () => {
  test("archives the course as admin", async () => {
    const training = new FakeTraining()

    await training.seedCourse("TS101")

    const result = await new ArchiveTrainingCourse(training).run({
      session: makeTestSession("root"),
      code: "TS101",
    })

    expect(result).toEqual({ reason: "archived" })
  })

  test("rejects member with forbidden", async () => {
    const training = new FakeTraining()

    await training.seedCourse("TS101")

    const result = await new ArchiveTrainingCourse(training).run({
      session: makeTestSession("member"),
      code: "TS101",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown code with course_not_found", async () => {
    const training = new FakeTraining()

    const result = await new ArchiveTrainingCourse(training).run({
      session: makeTestSession("root"),
      code: "NOPE",
    })

    expectApplicationError(result, NotFoundError, "course_not_found")
  })
})

describe("EnrollTraining", () => {
  test("enrolls self without permission check", async () => {
    const training = new FakeTraining()

    await training.seedCourse("TS101")

    const result = await new EnrollTraining(training).run({
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      courseCode: "TS101",
      enrolleeEmployeeCode: null,
      dueDate: "2026-06-30",
    })

    expect(result).toBeInstanceOf(TrainingEnrollment)

    if (result instanceof Error) {
      throw new Error("enroll failed")
    }

    expect(result.status).toBe("enrolled")
    expect(result.employeeId).toBe(toWorkforceEmployeeId(1))
  })

  test("rejects member enrolling another with forbidden", async () => {
    const training = new FakeTraining()

    const result = await new EnrollTraining(training).run({
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      courseCode: "TS101",
      enrolleeEmployeeCode: "E002",
      dueDate: null,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown course with course_not_found", async () => {
    const training = new FakeTraining()

    const result = await new EnrollTraining(training).run({
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      courseCode: "NOPE",
      enrolleeEmployeeCode: null,
      dueDate: null,
    })

    expectApplicationError(result, NotFoundError, "course_not_found")
  })
})

describe("RescheduleTrainingEnrollment", () => {
  test("reschedules the enrollment for the enrollee", async () => {
    const training = new FakeTraining()
    const enrollmentId = await training.seedEnrollment("TS101", toWorkforceEmployeeId(1))

    const result = await new RescheduleTrainingEnrollment(training).run({
      enrollmentId,
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      dueDate: "2026-12-31",
    })

    expect(result).toBeInstanceOf(TrainingEnrollment)

    if (result instanceof Error) {
      throw new Error("reschedule failed")
    }

    expect(result.dueDate).toBe("2026-12-31")
  })

  test("rejects non-owner member with forbidden", async () => {
    const training = new FakeTraining()
    const enrollmentId = await training.seedEnrollment("TS101", toWorkforceEmployeeId(1))

    const result = await new RescheduleTrainingEnrollment(training).run({
      enrollmentId,
      viewerEmployeeId: toWorkforceEmployeeId(999),
      session: makeTestSession("member", 999),
      dueDate: "2026-12-31",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("CompleteTrainingEnrollment", () => {
  test("completes the enrollment for the enrollee", async () => {
    const training = new FakeTraining()
    const enrollmentId = await training.seedEnrollment("TS101", toWorkforceEmployeeId(1))

    const result = await new CompleteTrainingEnrollment(training).run({
      enrollmentId,
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member", 1),
      score: 85,
      completedAt: "2026-06-15T10:00:00.000Z",
    })

    expect(result).toBeInstanceOf(TrainingEnrollment)

    if (result instanceof Error) {
      throw new Error("complete failed")
    }

    expect(result.status).toBe("completed")
    expect(result.score).toBe(85)
  })

  test("rejects non-owner member with forbidden", async () => {
    const training = new FakeTraining()
    const enrollmentId = await training.seedEnrollment("TS101", toWorkforceEmployeeId(1))

    const result = await new CompleteTrainingEnrollment(training).run({
      enrollmentId,
      viewerEmployeeId: toWorkforceEmployeeId(999),
      session: makeTestSession("member", 999),
      score: null,
      completedAt: "2026-06-15T10:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects already completed enrollment", async () => {
    const training = new FakeTraining()
    const enrollmentId = await training.seedEnrollment("TS101", toWorkforceEmployeeId(1))

    await new CompleteTrainingEnrollment(training).run({
      enrollmentId,
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member", 1),
      score: 90,
      completedAt: "2026-06-15T10:00:00.000Z",
    })

    const result = await new CompleteTrainingEnrollment(training).run({
      enrollmentId,
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member", 1),
      score: 95,
      completedAt: "2026-06-16T10:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "already_completed")
  })
})

describe("CancelTrainingEnrollment", () => {
  test("cancels the enrollment for the enrollee", async () => {
    const training = new FakeTraining()
    const enrollmentId = await training.seedEnrollment("TS101", toWorkforceEmployeeId(1))

    const result = await new CancelTrainingEnrollment(training).run({
      enrollmentId,
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects non-owner member with forbidden", async () => {
    const training = new FakeTraining()
    const enrollmentId = await training.seedEnrollment("TS101", toWorkforceEmployeeId(1))

    const result = await new CancelTrainingEnrollment(training).run({
      enrollmentId,
      viewerEmployeeId: toWorkforceEmployeeId(999),
      session: makeTestSession("member", 999),
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with enrollment_not_found", async () => {
    const training = new FakeTraining()

    const result = await new CancelTrainingEnrollment(training).run({
      enrollmentId: crypto.randomUUID(),
      viewerEmployeeId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
    })

    expectApplicationError(result, NotFoundError, "enrollment_not_found")
  })
})
