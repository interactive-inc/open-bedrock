import { describe, expect, test } from "bun:test"
import { TrainingCourse } from "@/domain/training/training-course.entity"
import { TrainingEnrollment } from "@/domain/training/training-enrollment.entity"
import { CreateTrainingCourse } from "@/application/training/create-training-course"
import { GetTrainingCourse } from "@/application/training/get-training-course"
import { UpdateTrainingCourse } from "@/application/training/update-training-course"
import { ArchiveTrainingCourse } from "@/application/training/archive-training-course"
import { EnrollTraining } from "@/application/training/enroll-training"
import { GetTrainingEnrollment } from "@/application/training/get-training-enrollment"
import { RescheduleTrainingEnrollment } from "@/application/training/reschedule-training-enrollment"
import { CompleteTrainingEnrollment } from "@/application/training/complete-training-enrollment"
import { CancelTrainingEnrollment } from "@/application/training/cancel-training-enrollment"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import type { Context } from "@/env"

async function seedCourse(context: Context, code: string): Promise<TrainingCourse> {
  const result = await new CreateTrainingCourse(context).run({
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

async function seedEnrollment(
  context: Context,
  db: D1Database,
  courseCode: string,
  employeeId: number,
): Promise<TrainingEnrollment> {
  await seedCourse(context, courseCode)

  await seedD1(db, "employees", [
    {
      id: employeeId,
      code: `E${String(employeeId).padStart(3, "0")}`,
      name: "Test Employee",
      dept_id: 1,
      dept_name: "Engineering",
      position: "Engineer",
      status: "active",
    },
  ])

  const result = await new EnrollTraining(context).run({
    viewerEmployeeId: employeeId,
    session: makeTestSession("member"),
    courseCode: courseCode,
    enrolleeEmployeeCode: null,
    dueDate: "2026-06-30",
  })

  if (result instanceof Error) {
    throw new Error("seed enrollment failed")
  }

  return result
}

describe("CreateTrainingCourse", () => {
  test("creates a course as admin", async () => {
    const { context } = createTestContext()

    const result = await new CreateTrainingCourse(context).run({
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
    const { context } = createTestContext()

    const result = await new CreateTrainingCourse(context).run({
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
    const { context } = createTestContext()

    await seedCourse(context, "TS101")

    const result = await new CreateTrainingCourse(context).run({
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

describe("GetTrainingCourse", () => {
  test("returns the course by code", async () => {
    const { context } = createTestContext()

    await seedCourse(context, "TS101")

    const result = await new GetTrainingCourse(context).run({ code: "TS101" })

    expect(result).toBeInstanceOf(TrainingCourse)
  })

  test("rejects unknown code with course_not_found", async () => {
    const { context } = createTestContext()

    const result = await new GetTrainingCourse(context).run({ code: "NOPE" })

    expectApplicationError(result, NotFoundError, "course_not_found")
  })
})

describe("UpdateTrainingCourse", () => {
  test("updates the course as admin", async () => {
    const { context } = createTestContext()

    await seedCourse(context, "TS101")

    const result = await new UpdateTrainingCourse(context).run({
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
    const { context } = createTestContext()

    await seedCourse(context, "TS101")

    const result = await new UpdateTrainingCourse(context).run({
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
    const { context } = createTestContext()

    await seedCourse(context, "TS101")

    await new ArchiveTrainingCourse(context).run({
      session: makeTestSession("root"),
      code: "TS101",
    })

    const result = await new UpdateTrainingCourse(context).run({
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
    const { context } = createTestContext()

    const result = await new UpdateTrainingCourse(context).run({
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
    const { context } = createTestContext()

    await seedCourse(context, "TS101")

    const result = await new ArchiveTrainingCourse(context).run({
      session: makeTestSession("root"),
      code: "TS101",
    })

    expect(result).toEqual({ reason: "archived" })
  })

  test("rejects member with forbidden", async () => {
    const { context } = createTestContext()

    await seedCourse(context, "TS101")

    const result = await new ArchiveTrainingCourse(context).run({
      session: makeTestSession("member"),
      code: "TS101",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown code with course_not_found", async () => {
    const { context } = createTestContext()

    const result = await new ArchiveTrainingCourse(context).run({
      session: makeTestSession("root"),
      code: "NOPE",
    })

    expectApplicationError(result, NotFoundError, "course_not_found")
  })
})

describe("EnrollTraining", () => {
  test("enrolls self without permission check", async () => {
    const { context, db } = createTestContext()

    await seedCourse(context, "TS101")

    await seedD1(db, "employees", [
      {
        id: 1,
        code: "E001",
        name: "Test Employee",
        dept_id: 1,
        dept_name: "Engineering",
        position: "Engineer",
        status: "active",
      },
    ])

    const result = await new EnrollTraining(context).run({
      viewerEmployeeId: 1,
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
  })

  test("rejects member enrolling another with forbidden", async () => {
    const { context } = createTestContext()

    const result = await new EnrollTraining(context).run({
      viewerEmployeeId: 1,
      session: makeTestSession("member"),
      courseCode: "TS101",
      enrolleeEmployeeCode: "E002",
      dueDate: null,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown course with course_not_found", async () => {
    const { context } = createTestContext()

    const result = await new EnrollTraining(context).run({
      viewerEmployeeId: 1,
      session: makeTestSession("member"),
      courseCode: "NOPE",
      enrolleeEmployeeCode: null,
      dueDate: null,
    })

    expectApplicationError(result, NotFoundError, "course_not_found")
  })
})

describe("GetTrainingEnrollment", () => {
  test("returns the enrollment for the enrollee", async () => {
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new GetTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 1,
      session: makeTestSession("member"),
    })

    expect(result).toBeInstanceOf(TrainingEnrollment)
  })

  test("returns the enrollment for a manager", async () => {
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new GetTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 999,
      session: makeTestSession("manager", 999),
    })

    expect(result).toBeInstanceOf(TrainingEnrollment)
  })

  test("rejects non-owner member with forbidden", async () => {
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new GetTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 999,
      session: makeTestSession("member", 999),
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with enrollment_not_found", async () => {
    const { context } = createTestContext()

    const result = await new GetTrainingEnrollment(context).run({
      enrollmentId: 9999,
      viewerEmployeeId: 1,
      session: makeTestSession("root"),
    })

    expectApplicationError(result, NotFoundError, "enrollment_not_found")
  })
})

describe("RescheduleTrainingEnrollment", () => {
  test("reschedules the enrollment for the enrollee", async () => {
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new RescheduleTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 1,
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
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new RescheduleTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 999,
      session: makeTestSession("member", 999),
      dueDate: "2026-12-31",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("CompleteTrainingEnrollment", () => {
  test("completes the enrollment for the enrollee", async () => {
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new CompleteTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 1,
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
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new CompleteTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 999,
      session: makeTestSession("member", 999),
      score: null,
      completedAt: "2026-06-15T10:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects already completed enrollment", async () => {
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    await new CompleteTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 1,
      session: makeTestSession("member", 1),
      score: 90,
      completedAt: "2026-06-15T10:00:00.000Z",
    })

    const result = await new CompleteTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 1,
      session: makeTestSession("member", 1),
      score: 95,
      completedAt: "2026-06-16T10:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "already_completed")
  })
})

describe("CancelTrainingEnrollment", () => {
  test("cancels the enrollment for the enrollee", async () => {
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new CancelTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 1,
      session: makeTestSession("member"),
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects non-owner member with forbidden", async () => {
    const { context, db } = createTestContext()
    const enrollment = await seedEnrollment(context, db, "TS101", 1)

    if (enrollment.id === null) {
      throw new Error("id is null")
    }

    const result = await new CancelTrainingEnrollment(context).run({
      enrollmentId: enrollment.id,
      viewerEmployeeId: 999,
      session: makeTestSession("member", 999),
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with enrollment_not_found", async () => {
    const { context } = createTestContext()

    const result = await new CancelTrainingEnrollment(context).run({
      enrollmentId: 9999,
      viewerEmployeeId: 1,
      session: makeTestSession("member"),
    })

    expectApplicationError(result, NotFoundError, "enrollment_not_found")
  })
})
